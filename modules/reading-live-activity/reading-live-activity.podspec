require 'json'
package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'reading-live-activity'
  s.version        = package['version']
  s.summary        = 'Live Activity native module for reading sessions'
  s.authors        = 'ChapterChat'
  s.homepage       = 'https://github.com/placeholder'
  s.license        = 'MIT'
  s.platforms      = { ios: '16.2' }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/placeholder', tag: s.version.to_s }
  s.static_framework = true
  s.source_files   = 'ios/**/*.swift'
  s.dependency     'ExpoModulesCore'
end
