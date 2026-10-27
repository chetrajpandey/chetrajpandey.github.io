# Website maintenance

## Local preview and editor

Run `Open Website & Editor.command` from the repository, or use its desktop shortcut.

- Preview: http://127.0.0.1:4000/
- Editor: http://127.0.0.1:4001/

Save any open editor form before running `Close Website & Editor.command` (also available as a desktop shortcut). It stops only the launcher-managed preview and editor for this checkout, after checking their saved process IDs, working folder and ports. It does not stop unrelated services or modify website content. `ruby local-admin/stop.rb --dry-run` checks the targets without stopping them.

The launcher reuses existing servers. Logs and process IDs are stored in `.local-preview/`.

## Content

The local editor saves source files in this repository. It does not commit or push changes.

| Editor section | Content |
| --- | --- |
| Page text | Introductions, headings, homepage labels, hiring guidance, popup text and enable switch |
| Bio & profile | Biographies, affiliation, contact information, education, portrait, CV and profile links |
| About details | Professional experience, awards and fellowships, leadership |
| News | Updates, activities, appearances and professional service |
| Research | Research directions, descriptions, figures and related papers |
| Teaching | Courses, institutions, terms and syllabus links |
| Students | Roles, start and expected graduation years, bios, interests, photos and profile links |
| Publications | Published work, preprints, posters and technical reports |
| Software & Data | Products, repositories, datasets and related publications |
| Hiring | Openings, application instructions, fliers and position history |
| Event gallery | Event narratives, photographs, captions and related work |
| Appearance | Primary accent color and derived theme colors |

Blank expected graduation years display “present.” Moving a student to Former students transfers their name and LinkedIn link. The hiring popup, when enabled, appears once per browser-tab session and can be reopened manually.

Page text is stored in `_data/page_text.json`; other structured content is under `_data/`. Research and event documents use `_research/` and `_events/`. Navigation labels and ordering are in `_data/navigation.json`. Shared templates and styles are under `_layouts/`, `_includes/`, and `assets/`.

## New computer

Install Git, Ruby and Bundler, clone the repository, then run:

```sh
bundle install
ruby local-admin/launch.rb
```

The repository launcher remains portable; a desktop shortcut referencing an old computer’s path must be recreated.

## Build and deployment

```sh
bundle exec jekyll build
```

Preview changes before committing and pushing to `main`. The workflow in `.github/workflows/pages.yml` builds and deploys the site. GitHub Pages uses GitHub Actions as its publishing source. Production URL and base path are configured in `_config.yml`.

## Files and backups

`_site/` is generated output. Local dependencies, editor backups and preview logs are Git-ignored. The local editor and this guide are excluded from the public site by `_config.yml`, although tracked source remains visible in a public repository.

Editor saves create recoverable backups in `.local-admin-backups/`. Files under `assets/`, including uploads and public CVs, are public website content. Private source documents must remain outside published assets and covered by the repository’s exclusions.
