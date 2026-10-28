# Local website editor

Recommended: double-click **Open Website & Editor.command** in the website folder to start both servers and open both pages. You can close its Terminal window afterward. Running it again safely reuses already-running servers.

To start only the editor manually, run from the website folder:

```sh
ruby local-admin/server.rb
```

Or double-click `start.command` inside `local-admin`. Open **http://127.0.0.1:4001/**. Keep the terminal open while editing; Ctrl+C stops the editor. This uses Ruby and WEBrick already installed on this Mac. It does not need npm, a CMS subscription, a GitHub login, or a hosted backend.

If using another Ruby installation without WEBrick, the project's existing Gemfile includes it: run `bundle install` once, then `bundle exec ruby local-admin/server.rb`.

## Everyday workflow

1. Start the normal Jekyll preview (`bundle exec jekyll serve`, port 4000) when you want to see the website update.
2. Start the editor on port 4001.
3. Choose News, Bio & profile, Teaching, Research, Students, Publications, or Event gallery.
4. Add or edit entries using the forms, then click **Save locally**.
5. Refresh the website preview to review changes. Jekyll watches your source files and rebuilds.
6. Commit and push your changes using GitHub Desktop, your editor, or Git. GitHub Pages publishes the new version.

The editor does not commit or push. The **View website** button assumes the normal Jekyll server is running at http://127.0.0.1:4000/.

## What the forms update

- News: `_data/news.json` (dates, categories, titles, announcements, optional links).
- Current and past students: `_data/people.json` (names, groups, interests, optional profile/LinkedIn links and photos).
- Publications: `_data/publications.json` (citations, type, year, links, featured status).
- Gallery: Markdown files in `_events/` (event notes, date, location, summary, photos, captions, recordings, related posters).
- Uploaded images: `assets/uploads/`. JPEG, PNG, WebP, and GIF files up to 20 MB each are supported. Export HEIC images to JPEG before uploading.

New publication keys and event filenames are generated automatically. Existing keys and event URLs remain stable. The first photo is the event cover; **Move up** changes the order. Every event photo needs an image description for accessibility. Existing recordings and related-poster links are retained when editing an event.

Delete buttons remove local content only. Deleting a publication that is linked by a research or event page is blocked; remove the related-work link first. An event linked from News cannot be deleted until that News link is updated. Removing a photo from an entry does not delete its uploaded file.

Uploads are written as soon as selected, even if you later cancel the form. Only photos attached to a saved entry are shown on the website. Include any used `assets/uploads/` files in the same Git commit as your content edits.

## Recovery and concurrent edits

Before replacing a content file, the editor stores a copy under `.local-admin-backups/`. Deleted event files are moved there. To undo a mistake, stop editing, copy the appropriate backup over its original source file, then reload the editor. The folder is excluded from Git and the website build.

If a file changes while a form is open, saving is blocked instead of overwriting the newer version. Copy any unsaved text you need, cancel the form, choose **Reload content**, and reopen the entry.

The editor listens only on `127.0.0.1` and validates the request host, origin, and a per-session token. Keep it local; it is not an Internet-facing or multi-user admin system. Both `local-admin/` and backups are excluded from the Jekyll output, so GitHub Pages remains a static public site.

Research directions can also be added, edited, or deleted in the local editor. The Research form includes summaries, detailed text, the research question, focus areas, illustration uploads, related publications, resource links, and display order. Existing URLs remain stable when titles change.

The local editor also includes Teaching (add, edit, remove, or move courses between Current and Past) and Bio & profile (home introduction, full biography, affiliation, contact details, education, links, portrait uploads, public CV PDF uploads, and recruitment notices). Biography paragraphs are separated with blank lines in the form. CV uploads are public website assets; the original tenure-review document remains excluded.

### Hiring

Use **Hiring → Add hiring ad** for a PhD or undergraduate opportunity. Enter the posted date, project details, application instructions, optional deadline, and optional PDF flier (up to 20 MB). Save locally and review `/hiring/` in the website preview.

When recruitment ends, edit the ad and change **Status** to **Filled** or **Closed**. The ad remains under Previous opportunities with a crossed-out title; its PDF stays available. Use deletion only for an erroneous entry, rather than to close a position. The source records live in `_data/hiring.json`, and uploaded fliers are in `assets/documents/`. Commit both when publishing.

### SVG images

Profile portraits, student images, research illustrations, and gallery uploads accept static `.svg` files alongside JPEG, PNG, WebP, and GIF (20 MB maximum). SVG research illustrations preview directly in the editor. Export SVGs with embedded images; scripts, animation, embedded HTML, external resource links, and XML document types are rejected. Uploaded SVGs remain vector images on the public website.

### Complete teaching and career history

**Teaching** supports Current, Past, and Developed entries, with an institution field and optional course code. Developed entries may leave the term blank. Use Developed for courses designed, co-developed, or redesigned, recording your contribution in the description.

**Career** edits `_data/career.json`: professional experience, awards, leadership, affiliations, activities, and skills appear on About. Funded grant announcements belong in **News**; pending and unfunded proposals are excluded from public content. Publications also support the **Submitted** type for manuscripts under review.

Proposal submissions may be announced in **News** using the **Proposal submission** category. Disclose only the agency and submission count; keep proposal titles, topics, amounts, and links private. Use a year-only date if the submission date is unknown.

### Appearance and university colors

Open **Appearance → Edit colors** and enter one six-digit hex code, such as `#4d1979`. There are no palette selectors or separate dark-mode settings. Light and dark accent shades are generated automatically with readable contrast. Save locally to update `_data/appearance.json`, then commit and push to publish.

Links, buttons, navigation accents, borders, keyboard focus rings, and the favicon use the shared accent colors. Neutral backgrounds and text stay consistent. Uploaded images and research illustrations retain their original colors. University names, affiliation, contact details, and biography are edited separately in **Bio & profile**. Enter `#4d1979` to restore the original TCU accent.

The public site uses the original cool off-white background (`#f8fafc`) with a faint blue wash. Header and footer gradients follow the light-mode accent chosen in Appearance, with readable white navigation text. Individual profile and student portraits use circular crops automatically, including newly uploaded images; event photos and research diagrams keep their normal shapes.

### Page review updates (October 23, 2026)

The About page displays only biography, contact details, and education. Career records are retained in the local editor for reference but no longer rendered publicly. Submitted manuscripts belong in News under **Manuscript submission**, never Publications. Teaching records include an editable course-link label so a direct syllabus PDF can be distinguished from a university syllabus hub or curriculum index. A first visit defaults to light mode regardless of operating-system preference; explicitly selecting dark mode is remembered across visits.

### Content placement correction

**About details** edits Professional experience, Awards and fellowships, and Leadership on the public About page. Activities and appearances are edited in **News** under Activity or Appearance. The Career archive is no longer part of the editor. Student alumni are labeled Former students. Teaching does not show syllabus-hub links or course-development badges; direct syllabus PDFs and relevant curriculum links remain.

### Student biographies and interest badges

Student profiles have a **Short biography** field (up to 6,000 characters, with paragraphs) and **Research-interest badges** (one topic per line, up to 20 topics, each at most 120 characters). Existing free-text interest descriptions were preserved as biographies. Biographies, badge text, names, and links wrap inside the student cards; photos remain circular. Former students retain their simpler name and LinkedIn format.

### Move a student to Former students

Open **Students → Edit student → Move to Former students**. The optional LinkedIn field is prefilled when the existing profile URL is a LinkedIn URL. Review the name and LinkedIn link, then confirm the move. The editor adds a name-and-LinkedIn former-student entry and removes the active profile in one file update, keeping the full original profile in a local backup. Personal websites are not treated as LinkedIn links. Missing LinkedIn links are allowed; duplicate former-student entries are rejected for review. The website updates after its normal local rebuild; commit and push to publish.

### Automatic teaching panels

Teaching creates an institution panel from every institution name in your course records. The university in Bio & profile appears first; remaining panels follow the course data order. New course records are inserted first, and their institution defaults to the profile institution. Use `University · Campus` to collect campuses into one university panel while preserving campus details. TCU, Georgia State, and Tribhuvan retain their institution palettes; new institution panels use the site accent.
