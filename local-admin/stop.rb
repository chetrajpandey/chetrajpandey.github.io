#!/usr/bin/env ruby
# Stops only launcher-managed services belonging to this checkout.
require 'open3'
require 'fileutils'

ROOT = File.realpath(File.join(__dir__, '..'))
RUNTIME = File.join(ROOT, '.local-preview')
DRY_RUN = ARGV.include?('--dry-run')
SERVICES = [
  { name: 'Website preview', pid: 'website.pid', port: 4000 },
  { name: 'Local admin panel', pid: 'editor.pid', port: 4001 }
].freeze

def alive?(pid)
  Process.kill(0, pid)
  true
rescue Errno::ESRCH
  false
end

def belongs_to_checkout?(pid, service)
  cwd, cwd_status = Open3.capture2('/usr/sbin/lsof', '-a', '-p', pid.to_s, '-d', 'cwd', '-Fn')
  command, command_status = Open3.capture2('/bin/ps', '-p', pid.to_s, '-o', 'command=')
  listeners, listener_status = Open3.capture2('/usr/sbin/lsof', '-a', '-p', pid.to_s, "-iTCP:#{service[:port]}", '-sTCP:LISTEN', '-t')
  expected_command = service[:port] == 4000 ? command.include?('jekyll') && command.include?('serve') : command.include?(File.join(ROOT, 'local-admin', 'server.rb'))
  cwd_status.success? && command_status.success? && listener_status.success? &&
    cwd.lines.map(&:strip).include?('n' + ROOT) &&
    listeners.lines.map(&:strip).include?(pid.to_s) && expected_command
end

begin
  unless Dir.exist?(RUNTIME)
    puts 'No local preview services have been started from this folder.'
    exit 0
  end
  failed = false
  File.open(File.join(RUNTIME, 'launcher.lock'), 'a') do |lock|
    unless lock.flock(File::LOCK_EX | File::LOCK_NB)
      warn 'The preview is starting or stopping. Try this shortcut again in a moment.'
      exit 1
    end
    SERVICES.each do |service|
      path = File.join(RUNTIME, service[:pid])
      raw = File.file?(path) ? File.read(path).strip : ''
      unless raw.match?(/\A[1-9]\d*\z/) && raw.to_i > 1 && alive?(raw.to_i)
        puts "#{service[:name]} is already stopped."
        next
      end
      pid = raw.to_i
      unless belongs_to_checkout?(pid, service)
        warn "#{service[:name]}: saved process does not match this checkout and port; left untouched."
        failed = true
        next
      end
      if DRY_RUN
        puts "Verified #{service[:name]} (PID #{pid}, port #{service[:port]}). Would stop; left running."
        next
      end
      Process.kill('TERM', pid)
      deadline = Process.clock_gettime(Process::CLOCK_MONOTONIC) + 5
      sleep 0.1 while alive?(pid) && Process.clock_gettime(Process::CLOCK_MONOTONIC) < deadline
      if alive?(pid)
        warn "#{service[:name]} is still shutting down. It was not force-stopped."
        failed = true
      else
        puts "#{service[:name]} stopped."
      end
    end
  end
  puts DRY_RUN ? 'Check complete. No servers were stopped.' : 'Saved website files are unchanged. Use Open Website & Editor to start again.'
  exit(failed ? 1 : 0)
rescue StandardError => error
  warn error.message
  exit 1
end
