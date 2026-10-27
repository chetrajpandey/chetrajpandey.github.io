# Chetraj Pandey — Jekyll faculty website

A GitHub Pages website built with Jekyll. Shared Liquid layouts render your content into static HTML. No custom Python builder, database, or application server is required.

## One-click local startup

Double-click **Open Website & Editor.command** in this folder. It starts the website preview and local editor, then opens both in your default browser:

- Website: http://127.0.0.1:4000/
- Editor: http://127.0.0.1:4001/

You can close the Terminal window after startup; the servers keep running. Run the same shortcut again after a restart or whenever either page is unavailable. Already-running servers are reused. The shortcut does not install anything, commit, or push. It uses the Jekyll dependencies already installed in `vendor/` on this Mac. Logs are in `.local-preview/` if startup fails. You can drag the shortcut into the Dock beside Trash for easy access.

## Update content with the local admin panel

You can now use forms instead of editing the data files. Run `ruby local-admin/server.rb` (or double-click `local-admin/start.command`) and open http://127.0.0.1:4001/.

Choose **News**, **Bio & profile**, **Teaching**, **Research**, **Students**, **Publications**, or **Event gallery**, make changes, and click **Save locally**. Upload student and event photos using the file chooser. Review the Jekyll preview, then commit and push as usual. The editor never pushes to GitHub. Keep both the editor and Jekyll preview running while reviewing updates.

See [the local editor guide](local-admin/README.md) for startup, uploads, backups, and recovery. The editor is excluded from the public website build.

## Update content on GitHub

Open a file, click the pencil, edit, and commit. GitHub builds and publishes the changes automatically once Pages is configured. You do not need Ruby or Jekyll installed to update content through GitHub.

| Update | Edit |
| --- | --- |
| Biography, contact details, recruitment, CV link | `_data/profile.json` |
| News and professional service | `_data/news.json` |
| Publications, posters, NASA memo, featured work | `_data/publications.json` |
| Current and past students | `_data/people.json` |
| Courses | `_data/teaching.json` |
| Research descriptions and related work | `_research/*.md` |
| Events, photo albums, visits, presentations | `_events/*.md` |
| Navigation order | `_data/navigation.json` |
| Colors, fonts, spacing, responsive layout | `assets/css/site.css` |
| Shared header and footer | `_layouts/default.html` |

JSON data files require double quotes and commas between items, with no trailing comma after the last item. Jekyll natively supports these JSON files. Markdown files have a metadata block between `---` lines followed by normal Markdown text.

## Research pages

Edit a file in `_research/`. The text below the second `---` line is the long research description; write ordinary Markdown, including headings, links, and lists. Metadata defines the title, summary, focus topics, illustration, and related publication IDs.

To add a new direction, copy a research file, change `slug`, `title`, `number`, and `permalink`, then edit its content. Use a unique lowercase slug containing letters, digits, and hyphens. For example, `permalink: "/research-new-topic.html"`. Jekyll automatically adds it to the research overview and home page.

The SVG images under `assets/research/` are conceptual schematics. Replace `image` and `image_alt` in a research file to use a figure from your work, with appropriate attribution. `publication_ids` references the `id` values in `_data/publications.json`.

## Event gallery

Each file in `_events/` is an event album. Copy an existing file to create an entry for a visit, conference, presentation, or team activity. Change its unique `slug`, `title`, `permalink`, `event_date`, `category`, `location`, and `description`; write the event narrative below the metadata block.

`event_date` accepts a quoted year (`"2026"`), month (`"2026-10"`), or full date (`"2026-10-15"`). Keep it quoted so sorting stays consistent. The first photo becomes the album cover; albums with no photos show a clear awaiting-photos message and still show event notes and related posters.

Save images under `assets/gallery/EVENT-SLUG/`. Replace `photos: []` with a list:

```yaml
photos:
  - src: "assets/gallery/agu-2024/team-poster.jpg"
    alt: "Describe the people and activity visible in this photo"
    caption: "Your caption and optional photo credit"
```

Clicking a photo opens the full image. Link posters and the NASA memo through `publication_ids`. Optional event `links` contain `label` and `url`, for example a video recording. Add a News entry linking to `event-SLUG.html` to announce an album. The site already has event albums for AGU 2024, AGU 2025, and the FDL HelioLab speaker appearance.

## News and professional service

Add records to `_data/news.json`:

```json
{
  "date": "2026-10",
  "title": "Announcement title",
  "text": "A short explanation for visitors.",
  "url": "event-your-event.html",
  "category": "Presentation"
}
```

An empty URL omits the Read more link. Dates accept quoted `YYYY`, `YYYY-MM`, or `YYYY-MM-DD`. Items sort automatically; the latest three appear on the home page. Category buttons derive from the data.

All five non-reviewing professional roles from the supplied CV are included: Big Data 2026 PC, ICTAI 2026 PC, SABID 2025 PC, Discovery Science 2024 PC, and ICMLA 2023 session chair. Institutional service is under its own News category. Reviewing activities are excluded.

## Current and past students

`_data/people.json` includes two PhD and five undergraduate placeholders. Replace their names and details, add photos and optional websites, then set `placeholder` to `false`. Supported current groups are `PhD students`, `Undergraduate researchers`, and `Collaborators`. An empty photo or URL is supported.

Past students use only names and optional LinkedIn URLs in `past_students`:

```json
{
  "name": "Student Name",
  "linkedin_url": "https://www.linkedin.com/in/PROFILE/"
}
```

Leave `linkedin_url` empty when unavailable.

## Publications and teaching

The publication list includes all nine supplied posters and the linked NASA technical memorandum. To add an entry, copy a record in `_data/publications.json`, set a unique `id`, and update its title, citation, year, type, and URL. Set `featured` to `true` to show it on the home page. All publication types are included in the automatic filters.

Course records in `_data/teaching.json` use `status: "Current"` or `"Past"`. Update this each semester. Use an empty URL for LMS-only materials.

## Public CV and private files

Save a public CV as `assets/documents/chetraj-pandey-cv.pdf` and set `cv_url` in `_data/profile.json` to that path. The CV link then appears automatically. Keep the filename stable for later replacements.

The supplied tenure-review PDF is explicitly excluded in `_config.yml` and `.gitignore`. The archive, README, and build configuration files are excluded from the published site. All files under `assets/` are public: do not put private material there. If you rename the tenure-review source PDF, update the exclusion too.

## Restyle the website

Edit the `:root` block in `assets/css/site.css` for global colors, typography, width, and corner radius. Responsive layouts are grouped near the end of that file. Shared markup lives under `_layouts/` and reusable components under `_includes/`.

## Local preview (optional)

Use a maintained Ruby installation with Bundler installed. Apple’s system Ruby on this Mac required an older installed SDK to compile native gems during verification; a Ruby installation from a version manager avoids depending on those system headers. GitHub builds do not depend on your Mac’s Ruby. Then run:

```sh
bundle install
bundle exec jekyll serve
```

Open http://127.0.0.1:4000. Jekyll rebuilds after content or style changes; refresh the browser to see them. Restart the server after changing `_config.yml`. Stop it with Ctrl+C.

For a production build:

```sh
bundle exec jekyll build
```

Generated files go into `_site/`; never edit that folder directly. Preview through `jekyll serve` rather than opening HTML files using `file://`, so site-root links resolve correctly.

## Publish on GitHub Pages

This folder is not currently a Git checkout, so the remote repository has not been changed.

1. Copy the source into your website repository, including `_config.yml`, underscore-prefixed directories, `.github`, and `.gitignore`. Do not upload `_site/` or `archive/`.
2. The workflow uses the `main` branch. Change `.github/workflows/pages.yml` if your repository uses another branch.
3. In **Settings → Pages → Build and deployment**, choose **GitHub Actions**.
4. Commit and push. The “Build and deploy Jekyll website” workflow uses GitHub’s official Jekyll build action and deploys `_site/`.

For `chetrajpandey.github.io`, leave `baseurl: ""`. For a project site such as `username.github.io/faculty`, set `baseurl: "/faculty"`. Shared links and assets use Jekyll’s `relative_url` filter so both paths work. Set `url` to your production domain when it changes. Keep an existing `CNAME` file if you use a custom domain.

This site uses no custom Jekyll plugins. GitHub’s native branch-based Jekyll publishing can also build it, but use one publishing method at a time; the supplied Actions workflow is the documented default.

Official references: [Jekyll data files](https://jekyllrb.com/docs/datafiles/), [Jekyll collections](https://jekyllrb.com/docs/collections/), [GitHub Pages with Jekyll](https://docs.github.com/en/pages/setting-up-a-github-pages-site-with-jekyll/creating-a-github-pages-site-with-jekyll).

Research directions can also be added, edited, or deleted in the local editor. The Research form includes summaries, detailed text, the research question, focus areas, illustration uploads, related publications, resource links, and display order. Existing URLs remain stable when titles change.

The local editor also includes Teaching (add, edit, remove, or move courses between Current and Past) and Bio & profile (home introduction, full biography, affiliation, contact details, education, links, portrait uploads, public CV PDF uploads, and recruitment notices). Biography paragraphs are separated with blank lines in the form. CV uploads are public website assets; the original tenure-review document remains excluded.

## Edit page text

Use **Page text** in the local admin to edit page introductions, homepage headings and links, About and People section headings, research and gallery labels, Software & Data supporting text, and general hiring inquiry guidance. Each page has a separate form. Text is saved in `_data/page_text.json`; use plain text, with no HTML. Individual biographies, courses, papers, and other records stay in their existing editor sections. Navigation labels remain in `_data/navigation.json`.
