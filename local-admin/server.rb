#!/usr/bin/env ruby
# Loopback-only editor. Jekyll and GitHub Pages remain the website build/hosting tools.
require 'webrick'
require 'json'
require 'yaml'
require 'date'
require 'digest'
require 'securerandom'
require 'tempfile'
require 'fileutils'
require 'uri'
require 'rexml/document'

class FacultyEditor
  class EditError < StandardError; end
  ROOT = File.realpath(File.join(__dir__, '..'))
  FILES = { 'page_text' => '_data/page_text.json', 'products' => '_data/products.json', 'appearance' => '_data/appearance.json', 'career' => '_data/career.json', 'hiring' => '_data/hiring.json', 'news' => '_data/news.json', 'publications' => '_data/publications.json', 'people' => '_data/people.json', 'profile' => '_data/profile.json', 'teaching' => '_data/teaching.json' }.freeze
  MAX_UPLOAD = 20 * 1024 * 1024
  GROUPS = ['PhD students', 'Undergraduate researchers', 'Collaborators'].freeze
  IMAGE_TYPES = { '.jpg' => 'image/jpeg', '.jpeg' => 'image/jpeg', '.png' => 'image/png', '.webp' => 'image/webp', '.gif' => 'image/gif', '.svg' => 'image/svg+xml' }.freeze

  def initialize(port = 4001)
    @port = port
    @token = SecureRandom.hex(32)
    @mutex = Mutex.new
  end

  def source_files
    FILES.values.map { |path| File.join(ROOT, path) } + Dir[File.join(ROOT, '_events', '*.md')].sort + Dir[File.join(ROOT, '_research', '*.md')].sort
  end

  def revision
    Digest::SHA256.hexdigest(source_files.map { |path| path + "\0" + File.binread(path) }.join("\0"))
  end

  def read_json(key)
    JSON.parse(File.read(File.join(ROOT, FILES.fetch(key))))
  end

  def read_document(path)
    text = File.read(path)
    match = text.match(/\A---\s*\n(.*?)\n---\s*\n(.*)\z/m)
    raise EditError, "Cannot read the front matter in #{File.basename(path)}." unless match
    metadata = YAML.safe_load(match[1]) || {}
    raise EditError, 'Event metadata must be a mapping.' unless metadata.is_a?(Hash)
    [metadata, match[2].strip]
  end

  def state
    events = Dir[File.join(ROOT, '_events', '*.md')].sort.map do |path|
      metadata, body = read_document(path)
      metadata.merge('body' => body, '_filename' => File.basename(path))
    end
    research = Dir[File.join(ROOT, '_research', '*.md')].sort.map do |path|
      metadata, body = read_document(path)
      metadata.merge('body' => body, '_filename' => File.basename(path))
    end
    people = read_json('people')
    { page_text: read_json('page_text'), products: read_json('products'), appearance: read_json('appearance'), career: read_json('career'), hiring: read_json('hiring'), profile: read_json('profile'), teaching: read_json('teaching'), research: research, news: read_json('news'), publications: read_json('publications'), students: people.fetch('members', []), alumni: people.fetch('past_students', []), gallery: events, revision: revision, token: @token }
  end

  def atomic_write(path, content)
    directory = File.dirname(path)
    raise EditError, 'Writing outside the website folder is not allowed.' unless File.realpath(directory).start_with?(ROOT + File::SEPARATOR)
    if File.exist?(path)
      backup_dir = File.join(ROOT, '.local-admin-backups')
      FileUtils.mkdir_p(backup_dir)
      backup_name = Time.now.utc.strftime('%Y%m%dT%H%M%S') + '-' + SecureRandom.hex(4) + '-' + File.basename(path)
      FileUtils.cp(path, File.join(backup_dir, backup_name))
    end
    Tempfile.create(['.editor-', '.tmp'], directory) do |file|
      file.write(content)
      file.flush
      file.fsync
      File.rename(file.path, path)
    end
  end

  def write_json(key, value)
    atomic_write(File.join(ROOT, FILES.fetch(key)), JSON.pretty_generate(value) + "\n")
  end

  def text(record, key, required = false, max = 30_000)
    value = record[key]
    raise EditError, "#{key} must be text." unless value.nil? || value.is_a?(String)
    value = (value || '').strip
    raise EditError, "Please enter #{key.tr('_', ' ')}." if required && value.empty?
    raise EditError, "#{key} is too long." if value.length > max
    value
  end

  def student_year(record, key)
    value = text(record, key, false, 4)
    raise EditError, "#{key.tr('_', ' ')} must be a four-digit year." unless value.empty? || value.match?(/\A[12]\d{3}\z/)
    value
  end

  def date_value(record, key)
    value = text(record, key, true, 10)
    raise EditError, 'Use a date such as 2026, 2026-10, or 2026-10-16.' unless value.match?(/\A\d{4}(-\d{2})?(-\d{2})?\z/)
    normalized = value.length == 4 ? value + '-01-01' : value.length == 7 ? value + '-01' : value
    Date.iso8601(normalized)
    value
  rescue Date::Error
    raise EditError, 'Please enter a valid calendar date.'
  end

  def url_value(record, key)
    value = text(record, key)
    return value if value.empty?
    uri = URI.parse(value)
    raise EditError, "#{key} must be a web, email, or local website link." unless [nil, 'http', 'https', 'mailto'].include?(uri.scheme)
    raise EditError, 'Protocol-relative links are not supported.' if value.start_with?('//')
    value
  rescue URI::InvalidURIError
    raise EditError, "Please enter a valid #{key.tr('_', ' ')}."
  end

  def linkedin_value(record, key)
    value = url_value(record, key)
    return '' if value.empty?
    uri = URI.parse(value)
    host = uri.host.to_s.downcase
    raise EditError, 'Use a LinkedIn web address for the LinkedIn field.' unless ['http', 'https'].include?(uri.scheme) && (host == 'linkedin.com' || host.end_with?('.linkedin.com'))
    value
  end

  def photo_path(value)
    return '' if value.nil?
    raise EditError, 'Please upload an image using the photo chooser.' unless value.is_a?(String)
    return '' if value.empty?
    relative = value.sub(%r{\A/}, '')
    candidate = File.expand_path(relative, ROOT)
    assets = File.realpath(File.join(ROOT, 'assets')) + File::SEPARATOR
    raise EditError, 'Photo must be an image inside assets/.' unless candidate.start_with?(assets) && File.file?(candidate) && File.realpath(candidate).start_with?(assets) && IMAGE_TYPES.key?(File.extname(candidate).downcase)
    validate_svg(File.binread(candidate)) if File.extname(candidate).downcase == '.svg'
    relative
  end

  def slug(value)
    value.downcase.gsub(/[^a-z0-9]+/, '-').gsub(/\A-|-\z/, '')[0, 100]
  end

  def unique_key(title, keys)
    stem = slug(title)
    stem = 'entry' if stem.empty?
    candidate = stem
    suffix = 2
    while keys.include?(candidate)
      candidate = "#{stem}-#{suffix}"
      suffix += 1
    end
    candidate
  end

  def checked_index(value, records)
    return nil if value.nil?
    raise EditError, 'That entry no longer exists. Reload the editor.' unless value.is_a?(Integer) && value >= 0 && value < records.length
    value
  end

  def references_to(publication_id)
    (Dir[File.join(ROOT, '_research', '*.md')] + Dir[File.join(ROOT, '_events', '*.md')]).select do |path|
      metadata, = read_document(path)
      Array(metadata['publication_ids']).include?(publication_id)
    end.map { |path| File.basename(path, '.md') } + read_json('products').select { |item| Array(item['publication_ids']).include?(publication_id) }.map { |item| 'Software & Data: ' + item['title'] }
  end

  def appearance_palette(color)
    raise EditError, 'Enter a six-digit hex code, such as #4d1979.' unless color.is_a?(String) && color.match?(/\A#[0-9a-f]{6}\z/i)
    color = color.downcase
    rgb = color.delete_prefix('#').scan(/../).map { |channel| channel.to_i(16) }
    luminance = lambda do |channels|
      channels.map { |n| n / 255.0 }.map { |n| n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4 }.zip([0.2126, 0.7152, 0.0722]).sum { |n, weight| n * weight }
    end
    light = rgb
    (0..20).each do |step|
      light = rgb.map { |n| (n * (1 - step / 20.0)).round }
      break if (0.9536 + 0.05) / (luminance.call(light) + 0.05) >= 4.5
    end
    dark = rgb
    (0..20).each do |step|
      dark = rgb.map { |n| (n + (255 - n) * step / 20.0).round }
      break if (luminance.call(dark) + 0.05) / (0.0108 + 0.05) >= 4.5
    end
    hex = lambda { |channels| '#' + channels.map { |n| format('%02x', n) }.join }
    { 'accent' => color, 'light_accent' => hex.call(light), 'dark_accent' => hex.call(dark) }
  end

  def news_links_to?(paths)
    config = YAML.safe_load(File.read(File.join(ROOT, '_config.yml')))
    own_host = URI.parse(config.fetch('url')).host
    base = config.fetch('baseurl', '').to_s
    targets = paths.map { |path| path.sub(%r{\A/}, '').sub(%r{/$}, '') }
    read_json('news').any? do |item|
      begin
        uri = URI.parse(item['url'].to_s)
        next false if uri.host && uri.host != own_host
        path = uri.path.to_s
        path = path.delete_prefix(base) if !base.empty? && path.start_with?(base + '/')
        targets.include?(path.sub(%r{\A/}, '').sub(%r{/$}, ''))
      rescue URI::InvalidURIError
        false
      end
    end
  end

  def save(payload)
    raise EditError, 'Files changed since you opened this form. Reload the editor before saving.' unless payload['revision'] == revision
    kind = payload['kind']
    record = payload['record'] || {}
    raise EditError, 'Invalid entry.' unless record.is_a?(Hash)
    deleting = payload['delete'] == true
    if kind == 'page_text'
      raise EditError, 'Page text cannot be deleted.' if deleting
      pages = read_json('page_text')
      key = payload['index']
      raise EditError, 'Choose a page to edit.' unless key.is_a?(String) && pages.key?(key)
      fields = pages.fetch(key).keys
      raise EditError, 'Page text fields changed. Reload the form.' unless record.keys.sort == fields.sort
      pages[key] = fields.each_with_object({}) do |field, values|
        if key == 'hiring' && field == 'notice_enabled'
          raise EditError, 'Choose whether to show the hiring popup.' unless [true, false].include?(record[field])
          values[field] = record[field]
        else
          values[field] = text(record, field, field == 'title' || field.end_with?('_heading') || field == 'greeting', 8000)
        end
      end
      write_json('page_text', pages)
    elsif kind == 'appearance'
      raise EditError, 'Appearance settings cannot be deleted.' if deleting
      color = text(record, 'accent', true, 7).downcase
      raise EditError, 'Enter a six-digit hex code, such as #4d1979.' unless color.match?(/\A#[0-9a-f]{6}\z/)
      value = appearance_palette(color)
      write_json('appearance', value)
    elsif kind == 'profile'
      raise EditError, 'Your profile cannot be deleted.' if deleting
      current = read_json('profile')
      value = current.merge('name' => text(record, 'name', true, 200), 'suffix' => text(record, 'suffix', false, 50), 'role' => text(record, 'role', true, 300), 'specialty' => text(record, 'specialty', false, 300), 'institution' => text(record, 'institution', true, 300), 'department' => text(record, 'department', true, 300), 'college' => text(record, 'college', false, 300), 'location' => text(record, 'location', true, 300), 'email' => text(record, 'email', true, 300), 'phone' => text(record, 'phone', false, 100), 'office' => text(record, 'office'), 'intro' => text(record, 'intro', true, 3000), 'recruiting' => record['recruiting'] == true, 'recruiting_text' => text(record, 'recruiting_text'), 'cv_url' => url_value(record, 'cv_url'), 'institution_url' => url_value(record, 'institution_url'), 'portrait' => photo_path(record['portrait']))
      raise EditError, 'Please enter a valid email address.' unless value['email'].match?(/\A[^\s@]+@[^\s@]+\.[^\s@]+\z/)
      raise EditError, 'Please choose a profile portrait.' if value['portrait'].empty?
      ['bio', 'home_bio'].each do |key|
        paragraphs = record.fetch(key, [])
        raise EditError, 'Enter at least one biography paragraph.' unless paragraphs.is_a?(Array) && !paragraphs.empty? && paragraphs.all? { |item| item.is_a?(String) && !item.strip.empty? && item.length <= 30_000 }
        value[key] = paragraphs.map(&:strip)
      end
      links = record.fetch('links', [])
      raise EditError, 'Invalid profile links.' unless links.is_a?(Array)
      value['links'] = links.map { |item| { 'label' => text(item, 'label', true, 200), 'url' => url_value(item, 'url') } }
      education = record.fetch('education', [])
      raise EditError, 'Invalid education list.' unless education.is_a?(Array)
      value['education'] = education.map { |item| { 'degree' => text(item, 'degree', true, 300), 'institution' => text(item, 'institution', true, 300), 'year' => text(item, 'year', true, 100) } }
      cv = value['cv_url']
      if !cv.empty? && URI.parse(cv).scheme.nil?
        path = File.expand_path(cv.sub(%r{\A/}, ''), ROOT)
        assets = File.join(ROOT, 'assets') + File::SEPARATOR
        raise EditError, 'Choose a PDF uploaded into the website assets.' unless path.start_with?(assets) && File.file?(path) && File.realpath(path).start_with?(assets) && File.extname(path).downcase == '.pdf'
      end
      write_json('profile', value)
    elsif kind == 'hiring'
      records = read_json('hiring')
      index = checked_index(payload['index'], records)
      old = index.nil? ? {} : records[index]
      if deleting
        raise EditError, 'Choose an existing ad to delete.' if index.nil?
        records.delete_at(index)
      else
        group = text(record, 'group', true)
        status = text(record, 'status', true)
        raise EditError, 'Choose PhD or Undergraduate.' unless ['PhD', 'Undergraduate'].include?(group)
        raise EditError, 'Choose Open, Filled, or Closed.' unless ['Open', 'Filled', 'Closed'].include?(status)
        flyer = url_value(record, 'flyer')
        unless flyer.empty?
          uri = URI.parse(flyer)
          raise EditError, 'Use a PDF inside website assets.' unless uri.scheme.nil?
          path = File.expand_path(flyer.sub(%r{\A/}, ''), ROOT)
          assets = File.join(ROOT, 'assets') + File::SEPARATOR
          raise EditError, 'Upload a PDF flier first.' unless path.start_with?(assets) && File.file?(path) && File.realpath(path).start_with?(assets) && File.extname(path).downcase == '.pdf'
        end
        value = old.merge('title' => text(record, 'title', true, 500), 'group' => group, 'status' => status, 'date' => date_value(record, 'date'), 'deadline' => text(record, 'deadline', false, 300), 'description' => text(record, 'description', true), 'instructions' => text(record, 'instructions', true), 'flyer' => flyer)
        value['id'] = unique_key(value['title'], records.map { |item| item['id'] }) if index.nil?
        index.nil? ? records.unshift(value) : records[index] = value
      end
      write_json('hiring', records)
    elsif kind == 'career'
      records = read_json('career')
      index = checked_index(payload['index'], records)
      if deleting
        raise EditError, 'Choose an existing record to delete.' if index.nil?
        records.delete_at(index)
      else
        group = text(record, 'group', true)
        groups = ['Professional experience', 'Awards and fellowships', 'Leadership', 'Professional affiliations', 'Activities and appearances', 'Technical skills']
        raise EditError, 'Choose a career category.' unless groups.include?(group)
        value = { 'group' => group, 'title' => text(record, 'title', true, 1000), 'period' => text(record, 'period', false, 300), 'description' => text(record, 'description', true), 'url' => url_value(record, 'url') }
        index.nil? ? records.unshift(value) : records[index] = value
      end
      write_json('career', records)
    elsif kind == 'teaching'
      records = read_json('teaching')
      index = checked_index(payload['index'], records)
      if deleting
        raise EditError, 'Choose an existing course to delete.' if index.nil?
        records.delete_at(index)
      else
        status = text(record, 'status', true)
        raise EditError, 'Choose Current, Past, or Developed for the course status.' unless ['Current', 'Past', 'Developed'].include?(status)
        value = { 'institution' => text(record, 'institution', false, 500), 'code' => text(record, 'code', false, 200), 'title' => text(record, 'title', true, 500), 'term' => text(record, 'term', status != 'Developed', 200), 'status' => status, 'description' => text(record, 'description', true), 'url' => url_value(record, 'url'), 'url_label' => text(record, 'url_label', false, 100) }
        index.nil? ? records.unshift(value) : records[index] = value
      end
      write_json('teaching', records)
    elsif kind == 'products'
      records = read_json('products')
      index = checked_index(payload['index'], records)
      if deleting
        raise EditError, 'Choose an existing product.' if index.nil?
        records.delete_at(index)
      else
        old = index.nil? ? {} : records[index]
        category = text(record, 'type', true, 100)
        raise EditError, 'Choose Software, Dataset, or Other.' unless ['Software', 'Dataset', 'Other'].include?(category)
        ids = record['publication_ids'] || []
        all_ids = read_json('publications').map { |item| item['id'] }
        raise EditError, 'Choose related papers from Publications.' unless ids.is_a?(Array) && ids.all? { |id| all_ids.include?(id) }
        value = old.merge('title' => text(record, 'title', true, 500), 'type' => category, 'description' => text(record, 'description', true, 10000), 'version' => text(record, 'version', false, 100), 'license' => text(record, 'license', false, 200), 'publication_ids' => ids.uniq)
        value['date'] = text(record, 'date', false, 10).empty? ? '' : date_value(record, 'date')
        ['repository_url', 'pypi_url', 'dataset_url', 'docs_url', 'demo_url'].each { |key| value[key] = url_value(record, key) }
        value['id'] = unique_key(value['title'], records.map { |item| item['id'] }) if index.nil?
        index.nil? ? records.unshift(value) : records[index] = value
      end
      write_json('products', records)
    elsif ['news', 'publications'].include?(kind)
      records = read_json(kind)
      index = checked_index(payload['index'], records)
      old = index.nil? ? {} : records[index]
      if deleting
        raise EditError, 'Choose an existing entry to delete.' if index.nil?
        if kind == 'publications'
          refs = references_to(old['id'])
          raise EditError, 'This publication is linked from: ' + refs.join(', ') + '. Remove those links first.' unless refs.empty?
        end
        records.delete_at(index)
      else
        value = old.merge('title' => text(record, 'title', true, 500), 'url' => url_value(record, 'url'))
        if kind == 'news'
          value.merge!('date' => date_value(record, 'date'), 'text' => text(record, 'text', true), 'category' => text(record, 'category', true, 100))
        else
          raise EditError, 'Submitted manuscripts belong in News, not Publications.' if record['type'] == 'Submitted'
          year = Integer(record['year'].to_s, 10) rescue nil
          raise EditError, 'Enter a publication year between 1900 and 2200.' unless year && (1900..2200).cover?(year)
          value.merge!('year' => year, 'type' => text(record, 'type', true, 80), 'citation' => text(record, 'citation', true), 'featured' => record['featured'] == true)
          value['id'] = unique_key(value['title'], records.map { |item| item['id'] }) if index.nil?
          # Keep existing IDs stable so research/event links survive edits.
          value['link_label'] = text(record, 'link_label')
        end
        index.nil? ? records.unshift(value) : records[index] = value
      end
      write_json(kind, records)
    elsif kind == 'move_student'
      people = read_json('people')
      members = people.fetch('members', [])
      index = checked_index(payload['index'], members)
      raise EditError, 'Choose an existing student to move.' if index.nil?
      student = members[index]
      name = text(record, 'name', true, 200)
      linkedin = linkedin_value(record, 'linkedin_url')
      alumni = people['past_students'] ||= []
      duplicate = alumni.any? { |item| item['name'].to_s.strip.downcase == name.downcase || (!linkedin.empty? && item['linkedin_url'].to_s.sub(%r{/$}, '') == linkedin.sub(%r{/$}, '')) }
      raise EditError, 'A matching former student already exists. Review that entry before moving this profile.' if duplicate
      alumni << { 'name' => name, 'linkedin_url' => linkedin }
      members.delete_at(index)
      # One write backs up and replaces the whole people file, avoiding a partial move.
      write_json('people', people)
    elsif ['students', 'alumni'].include?(kind)
      people = read_json('people')
      key = kind == 'students' ? 'members' : 'past_students'
      records = people[key] ||= []
      index = checked_index(payload['index'], records)
      if deleting
        raise EditError, 'Choose an existing student to delete.' if index.nil?
        records.delete_at(index)
      else
        value = { 'name' => text(record, 'name', true, 200) }
        if kind == 'students'
          group = text(record, 'group', true)
          raise EditError, 'Choose a current student group.' unless GROUPS.include?(group)
          interests = record.fetch('interests', [])
          raise EditError, 'Use at most 20 short interest badges (120 characters each).' unless interests.is_a?(Array) && interests.length <= 20 && interests.all? { |item| item.is_a?(String) && item.strip.length.between?(1, 120) }
          start_year = student_year(record, 'start_year')
          graduation_year = student_year(record, 'expected_graduation_year')
          raise EditError, 'Enter a start year when providing an expected graduation year.' if start_year.empty? && !graduation_year.empty?
          raise EditError, 'Expected graduation year cannot be before start year.' if !graduation_year.empty? && graduation_year.to_i < start_year.to_i
          value.merge!('start_year' => start_year, 'expected_graduation_year' => graduation_year, 'group' => group, 'role' => text(record, 'role', true, 200), 'linkedin_url' => linkedin_value(record, 'linkedin_url'), 'bio' => text(record, 'bio', false, 6000), 'interests' => interests.map(&:strip).uniq, 'photo' => photo_path(record['photo']), 'url' => url_value(record, 'url'), 'placeholder' => record['placeholder'] == true)
        else
          value['linkedin_url'] = url_value(record, 'linkedin_url')
        end
        index.nil? ? records << value : records[index] = value
      end
      write_json('people', people)
    elsif kind == 'research'
      documents = state[:research]
      index = checked_index(payload['index'], documents)
      old = index.nil? ? {} : documents[index]
      if deleting
        raise EditError, 'Choose an existing research page to delete.' if index.nil?
        linked = news_links_to?(['/research/' + old['slug'] + '/', '/research-' + old['slug'] + '.html'])
        raise EditError, 'A News entry links to this research page. Update that link before deleting the page.' if linked
        backup_dir = File.join(ROOT, '.local-admin-backups')
        FileUtils.mkdir_p(backup_dir)
        FileUtils.mv(File.join(ROOT, '_research', old['_filename']), File.join(backup_dir, SecureRandom.hex(8) + '-' + old['_filename']))
      else
        title = text(record, 'title', true, 500)
        key = index.nil? ? unique_key(title, documents.map { |item| item['slug'] }) : old['slug']
        order = Integer(record['number'].to_s, 10) rescue nil
        raise EditError, 'Choose a display order from 1 to 99.' unless order && (1..99).cover?(order)
        image = text(record, 'image', true)
        image = photo_path(image) unless !index.nil? && image == old['image']
        focus = record.fetch('focus', [])
        raise EditError, 'Add at least one focus area.' unless focus.is_a?(Array) && !focus.empty? && focus.all? { |item| item.is_a?(String) && !item.strip.empty? && item.length <= 1000 }
        ids = record.fetch('publication_ids', [])
        all_ids = read_json('publications').map { |item| item['id'] }
        raise EditError, 'Choose related work from the publication list.' unless ids.is_a?(Array) && (ids - all_ids).empty?
        resources = record.fetch('resources', [])
        raise EditError, 'Invalid resource links.' unless resources.is_a?(Array)
        resources = resources.map { |item| { 'label' => text(item, 'label', true, 200), 'url' => url_value(item, 'url') } }
        metadata = old.reject { |name, _| ['body', '_filename'].include?(name) }.merge('slug' => key, 'title' => title, 'number' => format('%02d', order), 'label' => text(record, 'label', true, 100), 'short' => text(record, 'short', true, 2000), 'intro' => text(record, 'intro', true, 5000), 'question' => text(record, 'question', true, 2000), 'image' => image, 'image_alt' => text(record, 'image_alt', true, 1000), 'image_caption' => text(record, 'image_caption', false, 2000), 'focus' => focus.map(&:strip), 'publication_ids' => ids, 'resources' => resources, 'layout' => 'research', 'nav' => '/research/', 'permalink' => '/research/' + key + '/')
        path = File.join(ROOT, '_research', index.nil? ? key + '.md' : old['_filename'])
        atomic_write(path, metadata.to_yaml + "---\n\n" + text(record, 'body') + "\n")
      end
    elsif kind == 'gallery'
      events = state[:gallery]
      index = checked_index(payload['index'], events)
      old = index.nil? ? {} : events[index]
      if deleting
        raise EditError, 'Choose an existing event to delete.' if index.nil?
        linked = news_links_to?(['/gallery/' + old['slug'] + '/', '/event-' + old['slug'] + '.html'])
        raise EditError, 'A News entry links to this event. Update or remove that link before deleting the event.' if linked
        path = File.join(ROOT, '_events', old['_filename'])
        backup_dir = File.join(ROOT, '.local-admin-backups')
        FileUtils.mkdir_p(backup_dir)
        FileUtils.mv(path, File.join(backup_dir, SecureRandom.hex(8) + '-' + old['_filename']))
      else
        title = text(record, 'title', true, 500)
        key = index.nil? ? unique_key(title, events.map { |event| event['slug'] }) : old['slug']
        photos = record.fetch('photos', [])
        raise EditError, 'Invalid photo list.' unless photos.is_a?(Array) && photos.length <= 100
        photos = photos.map { |photo| { 'src' => photo_path(photo['src']), 'alt' => text(photo, 'alt', true, 1000), 'caption' => text(photo, 'caption', false, 3000) } }
        raise EditError, 'Each photo needs an uploaded image.' if photos.any? { |photo| photo['src'].empty? }
        ids = record.fetch('publication_ids', [])
        all_ids = read_json('publications').map { |item| item['id'] }
        raise EditError, 'Choose related work from the publication list.' unless ids.is_a?(Array) && (ids - all_ids).empty?
        links = record.fetch('links', [])
        raise EditError, 'Invalid event links.' unless links.is_a?(Array)
        links = links.map { |item| { 'label' => text(item, 'label', true, 200), 'url' => url_value(item, 'url') } }
        metadata = old.reject { |name, _| ['body', '_filename'].include?(name) }.merge('slug' => key, 'title' => title, 'event_date' => date_value(record, 'event_date'), 'category' => text(record, 'category', true, 100), 'location' => text(record, 'location'), 'description' => text(record, 'description', true, 2000), 'photos' => photos, 'publication_ids' => ids, 'links' => links, 'layout' => 'event', 'nav' => '/gallery/', 'permalink' => '/gallery/' + key + '/')
        path = File.join(ROOT, '_events', index.nil? ? key + '.md' : old['_filename'])
        document = metadata.to_yaml + "---\n\n" + text(record, 'body') + "\n"
        FileUtils.mkdir_p(File.dirname(path))
        atomic_write(path, document)
      end
    else
      raise EditError, 'Unknown content section.'
    end
    state
  end

  # SVGs remain ordinary <img> assets. Accept static drawings, never active documents.
  def validate_svg(bytes)
    source = bytes.dup.force_encoding(Encoding::UTF_8)
    raise EditError, 'SVG must be valid UTF-8.' unless source.valid_encoding?
    raise EditError, 'Export a static SVG without document types or processing instructions.' if source.match?(/<!DOCTYPE|<!ENTITY|<\?(?!xml\s)/i)
    document = REXML::Document.new(source)
    root = document.root
    raise EditError, 'Choose a valid SVG drawing.' unless root && root.name == 'svg' && root.namespace == 'http://www.w3.org/2000/svg'
    allowed = %w[svg g defs title desc metadata path rect circle ellipse line polyline polygon text tspan textPath use symbol view clipPath mask pattern marker linearGradient radialGradient stop filter feBlend feColorMatrix feComponentTransfer feComposite feConvolveMatrix feDiffuseLighting feDisplacementMap feDistantLight feDropShadow feFlood feFuncA feFuncB feFuncG feFuncR feGaussianBlur feImage feMerge feMergeNode feMorphology feOffset fePointLight feSpecularLighting feSpotLight feTile feTurbulence image style]
    check_css = lambda do |value|
      raise EditError, 'SVG styles cannot load external resources.' if value.match?(/@import|@font-face|expression\s*\(|javascript:|\\/i)
      value.scan(/url\s*\((.*?)\)/im).each do |match|
        ref = match[0].strip.gsub(/\A['"]|['"]\z/, '')
        raise EditError, 'SVG styles may reference only internal drawing IDs.' unless ref.match?(/\A#[a-zA-Z_][\w:.-]*\z/)
      end
    end
    visit = lambda do |element|
      raise EditError, 'Export a static SVG without scripts, animation, or embedded HTML.' unless allowed.include?(element.name) && element.namespace == 'http://www.w3.org/2000/svg'
      element.attributes.each_attribute do |attribute|
        name = attribute.expanded_name
        value = attribute.value
        raise EditError, 'SVG event handlers are not allowed.' if name.downcase.start_with?('on')
        if attribute.name == 'href' || name == 'src'
          internal = value.match?(/\A#[a-zA-Z_][\w:.-]*\z/)
          raster = element.name == 'image' && value.match?(/\Adata:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+\/=\s]+\z/)
          raise EditError, 'SVG links must stay within the drawing; embed raster images when exporting.' unless internal || raster
        end
        raise EditError, 'SVG xml:base is not supported.' if name == 'xml:base'
        check_css.call(value)
      end
      check_css.call(element.texts.map(&:value).join) if element.name == 'style'
      element.each_element { |child| visit.call(child) }
    end
    visit.call(root)
    true
  rescue REXML::ParseException, SystemStackError
    raise EditError, 'Choose a well-formed static SVG drawing.'
  end

  def upload(request)
    raise EditError, 'Photo must be at most 20 MB.' if request['content-length'].to_i > MAX_UPLOAD
    bytes = request.body.to_s.b
    raise EditError, 'Choose a photo smaller than 20 MB.' if bytes.empty? || bytes.bytesize > MAX_UPLOAD
    filename = URI.decode_www_form(request.query_string.to_s).to_h.fetch('name', 'photo')
    ext = File.extname(filename).downcase
    valid = case ext
            when '.svg' then validate_svg(bytes)
            when '.jpg', '.jpeg' then bytes.start_with?("\xFF\xD8\xFF".b)
            when '.png' then bytes.start_with?("\x89PNG\r\n\x1A\n".b)
            when '.gif' then bytes.start_with?('GIF87a', 'GIF89a')
            when '.webp' then bytes.start_with?('RIFF') && bytes.byteslice(8, 4) == 'WEBP'
            else false
            end
    raise EditError, 'Use a JPEG, PNG, WebP, GIF, or static SVG image.' unless valid
    folder = File.join(ROOT, 'assets', 'uploads')
    FileUtils.mkdir_p(folder)
    stem = slug(File.basename(filename, '.*'))
    name = (stem.empty? ? 'photo' : stem) + '-' + Digest::SHA256.hexdigest(bytes)[0, 12] + ext
    target = File.join(folder, name)
    atomic_write(target, bytes) unless File.exist?(target)
    { path: 'assets/uploads/' + name }
  end

  def upload_document(request)
    raise EditError, 'PDF must be at most 20 MB.' if request['content-length'].to_i > MAX_UPLOAD
    bytes = request.body.to_s.b
    filename = URI.decode_www_form(request.query_string.to_s).to_h.fetch('name', 'cv.pdf')
    raise EditError, 'Choose a PDF smaller than 20 MB.' if bytes.empty? || bytes.bytesize > MAX_UPLOAD || File.extname(filename).downcase != '.pdf' || !bytes.start_with?('%PDF-')
    folder = File.join(ROOT, 'assets', 'documents')
    FileUtils.mkdir_p(folder)
    stem = slug(File.basename(filename, '.*'))
    name = (stem.empty? ? 'cv' : stem) + '-' + Digest::SHA256.hexdigest(bytes)[0, 12] + '.pdf'
    path = File.join(folder, name)
    atomic_write(path, bytes) unless File.exist?(path)
    { path: 'assets/documents/' + name }
  end

  def handle(request, response)
    response['Cache-Control'] = 'no-store'
    response['X-Content-Type-Options'] = 'nosniff'
    response['Referrer-Policy'] = 'no-referrer'
    response['Content-Security-Policy'] = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
    allowed_hosts = ["127.0.0.1:#{@port}", "localhost:#{@port}"]
    raise EditError, 'Open the editor using its localhost address.' unless allowed_hosts.include?(request['host'])
    if request.request_method != 'GET'
      raise EditError, 'Only same-origin editor requests are accepted.' unless allowed_hosts.map { |host| 'http://' + host }.include?(request['origin'])
      raise EditError, 'Reload the editor and try again.' unless request['x-admin-token'] == @token
    end
    @mutex.synchronize do
      if request.path == '/api/state' && request.request_method == 'GET'
        json(response, state)
      elsif request.path == '/api/save' && request.request_method == 'POST'
        raise EditError, 'Use a JSON request.' unless request['content-type'].to_s.start_with?('application/json')
        raise EditError, 'Entry data is too large.' if request.body.to_s.bytesize > 2_000_000
        json(response, save(JSON.parse(request.body)))
      elsif request.path == '/api/documents' && request.request_method == 'POST'
        json(response, upload_document(request))
      elsif request.path == '/api/photos' && request.request_method == 'POST'
        json(response, upload(request))
      elsif request.path == '/api/media' && request.request_method == 'GET'
        path = photo_path(request.query['path'])
        response['Content-Type'] = IMAGE_TYPES.fetch(File.extname(path).downcase)
        response.body = File.binread(File.join(ROOT, path))
      elsif ['/', '/index.html', '/app.js', '/style.css'].include?(request.path) && request.request_method == 'GET'
        name = request.path == '/' ? 'index.html' : request.path.delete_prefix('/')
        response['Content-Type'] = { '.html' => 'text/html; charset=utf-8', '.js' => 'text/javascript; charset=utf-8', '.css' => 'text/css; charset=utf-8' }.fetch(File.extname(name))
        response.body = File.read(File.join(__dir__, name))
      else
        response.status = 404
        json(response, { error: 'Not found.' })
      end
    end
  rescue EditError, JSON::ParserError, KeyError, ArgumentError => error
    response.status = 400
    json(response, { error: error.message })
  rescue StandardError => error
    warn "Editor error: #{error.class}: #{error.message}"
    response.status = 500
    json(response, { error: 'The editor could not save this change. Your existing file has been kept. Check the editor terminal for details.' })
  end

  def json(response, data)
    response['Content-Type'] = 'application/json; charset=utf-8'
    response.body = JSON.generate(data)
  end
end

if $PROGRAM_NAME == __FILE__
  port = Integer(ENV.fetch('ADMIN_PORT', '4001'))
  editor = FacultyEditor.new(port)
  server = WEBrick::HTTPServer.new(Port: port, BindAddress: '127.0.0.1', AccessLog: [], Logger: WEBrick::Log.new($stderr, WEBrick::Log::WARN))
  server.mount_proc('/') { |request, response| editor.handle(request, response) }
  trap('INT') { server.shutdown }
  trap('TERM') { server.shutdown }
  puts "Local website editor: http://127.0.0.1:#{port}/"
  puts 'Saves stay in your website folder. Commit and push when ready.'
  $stdout.flush
  server.start
end
