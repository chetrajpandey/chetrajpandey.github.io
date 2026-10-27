#!/usr/bin/env ruby
# Starts the two local services without installing anything or touching Git.
require 'fileutils'
require 'json'
require 'net/http'
require 'rbconfig'
require 'socket'
require 'timeout'

ROOT = File.realpath(File.join(__dir__, '..'))
RUNTIME = File.join(ROOT, '.local-preview')
SERVICES = [
  { name: 'Website preview', port: 4000, log: 'website.log', pid: 'website.pid' },
  { name: 'Local admin panel', port: 4001, log: 'editor.log', pid: 'editor.pid' }
].freeze

# Explicitly disable HTTP proxy discovery for these loopback-only requests.
def response_at(port)
  connection = Net::HTTP.new('127.0.0.1', port, nil)
  connection.open_timeout = 1
  connection.read_timeout = 1
  connection.get(port == 4000 ? '/' : '/api/state')
rescue IOError, SystemCallError, Timeout::Error
  nil
end

def expected_service?(service)
  response = response_at(service[:port])
  return false unless response && response.code == '200'
  if service[:port] == 4000
    profile = JSON.parse(File.read(File.join(ROOT, '_data/profile.json')))
    response.body.include?('<main id="main">') && response.body.include?(profile.fetch('name'))
  else
    data = JSON.parse(response.body)
    data.key?('revision') && data.key?('research') && data.key?('teaching') && data.key?('profile')
  end
rescue JSON::ParserError
  false
end

def occupied?(port)
  Timeout.timeout(1) { TCPSocket.open('127.0.0.1', port) { |socket| socket.close } }
  true
rescue SystemCallError, Timeout::Error
  false
end

def local_gems
  version = RbConfig::CONFIG.fetch('ruby_version')
  directory = File.join(ROOT, 'vendor', 'bundle', 'ruby', version)
  File.file?(File.join(directory, 'bin', 'jekyll')) ? directory : nil
end

def start_service(service)
  if expected_service?(service)
    puts "#{service[:name]} is already running."
    return
  end
  if occupied?(service[:port])
    raise "Port #{service[:port]} is being used by another service. Close that service and try again. Nothing has been stopped."
  end

  gems = local_gems
  environment = gems ? { 'GEM_HOME' => gems, 'GEM_PATH' => gems } : {}
  command = if service[:port] == 4000
              if gems
                environment['JEKYLL_NO_BUNDLER_REQUIRE'] = 'true'
                [RbConfig.ruby, File.join(gems, 'bin', 'jekyll'), 'serve', '--host', '127.0.0.1', '--port', '4000']
              else
                ['bundle', 'exec', 'jekyll', 'serve', '--host', '127.0.0.1', '--port', '4000']
              end
            else
              [RbConfig.ruby, File.join(ROOT, 'local-admin', 'server.rb')]
            end
  environment['ADMIN_PORT'] = '4001' if service[:port] == 4001
  log = File.join(RUNTIME, service[:log])
  process_id = Process.spawn(environment, *command, chdir: ROOT, in: File::NULL, out: [log, 'a'], err: [:child, :out], pgroup: true)
  Process.detach(process_id)
  File.write(File.join(RUNTIME, service[:pid]), process_id.to_s)
  puts "Starting #{service[:name].downcase}…"
  deadline = Process.clock_gettime(Process::CLOCK_MONOTONIC) + 20
  until expected_service?(service)
    begin
      Process.kill(0, process_id)
    rescue Errno::ESRCH
      raise "#{service[:name]} could not start. Details are in #{log}. If Jekyll dependencies are missing, run bundle install once from the website folder."
    end
    raise "#{service[:name]} did not become ready. Check #{log} for details." if Process.clock_gettime(Process::CLOCK_MONOTONIC) >= deadline
    sleep 0.25
  end
  puts "#{service[:name]} is ready."
end

begin
  FileUtils.mkdir_p(RUNTIME)
  File.open(File.join(RUNTIME, 'launcher.lock'), 'w') do |lock|
    unless lock.flock(File::LOCK_EX | File::LOCK_NB)
      puts 'The website shortcut is already starting. Please wait a moment.'
      exit 0
    end
    SERVICES.each { |service| start_service(service) }
    puts "\nWebsite: http://127.0.0.1:4000/"
    puts 'Editor:  http://127.0.0.1:4001/'
    unless ARGV.include?('--no-open')
      SERVICES.each do |service|
        opened = system('/usr/bin/open', "http://127.0.0.1:#{service[:port]}/")
        warn 'Could not open a browser automatically. Use the addresses above.' unless opened
      end
    end
    puts "\nYou can close this Terminal window. Both servers will keep running."
    puts 'Run this shortcut again whenever you want to edit or preview your website.'
  end
rescue StandardError => error
  warn "\n#{error.message}"
  exit 1
end
