'use strict';
const $ = (selector) => document.querySelector(selector);
const definitions = {
  page_text: {title:'Page text', description:'Edit page introductions, headings, homepage links, and general hiring guidance. Individual records remain in their own sections.', add:'Edit Home text'},
  products: {title:'Software & Data', description:'Repositories, datasets, and research products. Related publications are optional and stay in Publications too.', add:'Add product'},
  appearance: {title:'Appearance', description:'Set one hex color across the website. Matching light and dark shades are generated automatically. Update your university separately in Bio & profile.', add:'Edit colors'},
  career: {title:'About details', description:'Professional experience, awards and fellowships, and leadership displayed on About. Activities and appearances belong in News.', add:'Add record'},
  hiring: {title:'Hiring', description:'Separate PhD and undergraduate ads. Mark filled or closed to preserve their history.', add:'Add hiring ad'},
  profile: {title:'Bio & profile', description:'Your biography, affiliation, contact details, portrait, CV, and education.', add:'Edit profile'},
  teaching: {title:'Teaching', description:'University panels on the website collect offerings with the same course title into one card. Edit individual terms and course-development contributions here.', add:'Add course'},
  research: {title:'Research', description:'Research directions, descriptions, illustrations, and related work.', add:'Add research'},
  news: {title:'News', description:'Announcements, presentations, and professional service.', add:'Add news'},
  students: {title:'Students', description:'Research team and a simple list of former students.', add:'Add student'},
  publications: {title:'Publications', description:'Papers, posters, preprints, and technical reports.', add:'Add publication'},
  gallery: {title:'Event gallery', description:'Presentations, visits, and team activities—with photos and captions.', add:'Add event'},
};
let state;
let section = 'news';
let editing;
let busy = false;
let dirty = false;
const dialog = $('#editor');
const form = $('#entry-form');

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}
function paletteFromHex(accent) {
  const rgb=accent.slice(1).match(/../g).map((value) => parseInt(value,16));
  const luminance=(channels) => channels.map((n) => n/255).map((n) => n<=.04045 ? n/12.92 : ((n+.055)/1.055)**2.4).reduce((sum,n,index) => sum+n*[.2126,.7152,.0722][index],0);
  let light=rgb,dark=rgb;
  for(let step=0;step<=20;step++) { light=rgb.map((n) => Math.round(n*(1-step/20))); if((.9536+.05)/(luminance(light)+.05)>=4.5) break; }
  for(let step=0;step<=20;step++) { dark=rgb.map((n) => Math.round(n+(255-n)*step/20)); if((luminance(dark)+.05)/(.0108+.05)>=4.5) break; }
  const hex=(channels) => '#'+channels.map((n) => n.toString(16).padStart(2,'0')).join('');
  return {light_accent:hex(light),dark_accent:hex(dark)};
}
function appearancePreview(colors) {
  const preview=node('div',undefined,'appearance-preview');
  [['Light theme',colors.light_accent,'light'],['Dark theme',colors.dark_accent,'dark']].forEach(([label,color,theme]) => {
    const sample=node('div',undefined,'appearance-sample '+theme);
    sample.style.borderTopColor=color;
    const chrome=node('div',undefined,'appearance-chrome'); chrome.style.backgroundColor=colors.light_accent; chrome.append(node('strong','Your name, Ph.D.'),node('span','Home · News · Research')); sample.append(chrome,node('strong',label),node('p','Faculty website'));
    const link=node('span','Research · Teaching · News','appearance-link'); link.style.color=color;
    const swatch=node('span',color,'appearance-hex'); sample.append(link,swatch); preview.append(sample);
  });
  return preview;
}
function button(text, action, className = 'row-action') {
  const element = node('button', text, className);
  element.type = 'button';
  element.addEventListener('click', action);
  return element;
}
function message(text, error = false) {
  $('#status').textContent = text;
  $('#status').className = error ? 'error' : '';
}
async function request(path, options = {}) {
  const headers = {...options.headers};
  if (options.method && options.method !== 'GET') headers['X-Admin-Token'] = state.token;
  const response = await fetch(path, {...options, headers});
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'The editor could not complete this request.');
  return result;
}
async function load() {
  try {
    state = await request('/api/state');
    render();
    $('#content').setAttribute('aria-busy', 'false');
  } catch (error) { message(error.message, true); }
}
function media(path) { return '/api/media?path=' + encodeURIComponent(path); }
function photo(path, alt, className) {
  const image = node('img', undefined, className);
  image.src = media(path);
  image.alt = alt;
  image.loading = 'lazy';
  return image;
}
function matches(record) {
  const query = $('#search').value.trim().toLocaleLowerCase();
  return !query || JSON.stringify(record).toLocaleLowerCase().includes(query);
}
function render() {
  const definition = definitions[section];
  $('#section-title').textContent = definition.title;
  $('#section-description').textContent = definition.description;
  $('#add-entry').textContent = definition.add;
  document.querySelectorAll('[data-section]').forEach((item) => {
    if (item.dataset.section === section) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  });
  const container = $('#content');
  container.replaceChildren();
  if (!state) return;
  if (section === 'page_text') {
    Object.entries(state.page_text).forEach(([key,record]) => {
      if(!matches(record)) return;
      const title=key==='research_details' ? 'Research detail pages' : record.title;
      const card=node('article',undefined,'card');
      card.append(node('h2',title),node('p',record.intro || record.greeting || record.inquiry_intro || 'Section headings and labels'),button('Edit '+title+' text',() => openEditor('page_text',key),'button secondary'));
      container.append(card);
    });
  } else if (section === 'appearance') {
    const card=node('article',undefined,'card');
    card.append(node('h2','Website colors'),appearancePreview(paletteFromHex(state.appearance.accent || state.appearance.light_accent)),node('p','Colors apply to links, buttons, borders, focus rings, and the favicon. The light accent also sets the colored header and footer. Research illustrations and uploaded images keep their original colors.','help'),button('Edit colors',() => openEditor('appearance',null),'button'));
    container.append(card);
  } else if (section === 'profile') {
    const profile = state.profile;
    const summary = node('article',undefined,'card');
    summary.append(photo(profile.portrait,profile.name,'photo-preview portrait-preview'),node('h2',profile.name+', '+profile.suffix),node('p',profile.role+' · '+profile.institution),node('h3','Home page introduction'));
    profile.home_bio.forEach((paragraph) => summary.append(node('p',paragraph)));
    summary.append(node('h3','Full biography'));
    profile.bio.forEach((paragraph) => summary.append(node('p',paragraph)));
    summary.append(button('Edit bio & profile',() => openEditor('profile',null),'button'));
    container.append(summary);
  } else if (section === 'career') {
    ['Professional experience','Awards and fellowships','Leadership'].forEach((group) => {
      const records=state.career.map((record,index) => ({record,index})).filter(({record}) => record.group===group && matches(record));
      container.append(node('h2',group,'group-heading'));
      const list=node('div',undefined,'list');
      records.forEach(({record,index}) => list.append(listRow(record.title,record.period,record.description,() => openEditor('career',index))));
      container.append(records.length ? list : node('p','No records in this group.','empty'));
    });
  } else if (section === 'hiring') {
    ['PhD','Undergraduate'].forEach((group) => {
      container.append(node('h2',group+' opportunities','group-heading'));
      const list=node('div',undefined,'list');
      state.hiring.map((record,index) => ({record,index})).filter(({record}) => record.group===group && matches(record)).sort((a,b) => b.record.date.localeCompare(a.record.date)).forEach(({record,index}) => {
        list.append(listRow(record.title,record.status+' · Posted '+record.date,record.description,() => openEditor('hiring',index)));
      });
      container.append(list.childElementCount ? list : node('p','No ads in this group.','empty'));
    });
  } else if (section === 'teaching') {
    const universities=[...new Set(state.teaching.map((record) => (record.institution || '').split(' · ')[0] || 'Teaching'))];
    const primary=state.profile.institution;
    const ordered=[...universities.filter((name) => name===primary),...universities.filter((name) => name!==primary)];
    ordered.forEach((university) => {
      const records=state.teaching.map((record,index) => ({record,index})).filter(({record}) => matches(record) && ((record.institution || '').split(' · ')[0] || 'Teaching')===university);
      if(!records.length) return;
      container.append(node('h2',university,'group-heading'));
      const list=node('div',undefined,'list');
      records.forEach(({record,index}) => {
        const campus=(record.institution || '').split(' · ').slice(1).join(' · ');
        const meta=[record.code,record.term,campus].filter(Boolean).join(' · ');
        list.append(listRow(record.title,meta,record.description,() => openEditor('teaching',index)));
      });
      container.append(list);
    });
  } else if (section === 'students') {
    const groups = [
      ['PhD students', 'PhD students'],
      ['Undergraduate researchers', 'Undergraduate students'],
      ['Collaborators', 'Collaborators'],
    ];
    groups.forEach(([group, title]) => {
      const records = state.students.map((record,index) => ({record,index})).filter(({record}) => record.group === group && matches(record));
      if (!records.length) return;
      container.append(node('h2', title, 'group-heading'));
      const cards = node('div', undefined, 'cards');
      records.forEach(({record,index}) => cards.append(studentCard(record,index)));
      container.append(cards);
    });
    const pastHeading = node('div', undefined, 'section-actions');
    pastHeading.append(node('h2','Former students','group-heading'), button('Add former student', () => openEditor('alumni', null)));
    container.append(pastHeading);
    const past = state.alumni.map((record,index) => ({record,index})).filter(({record}) => matches(record));
    const list = node('div', undefined, 'list');
    past.forEach(({record,index}) => list.append(listRow(record.name, '', '', () => openEditor('alumni',index))));
    container.append(past.length ? list : node('p', 'No former students have been added yet.', 'empty'));
  } else if (section === 'research') {
    const list = node('div',undefined,'list');
    state.research.map((record,index) => ({record,index})).filter(({record}) => matches(record)).sort((a,b) => Number(a.record.number)-Number(b.record.number)).forEach(({record,index}) => {
      list.append(listRow(record.title,record.label,record.short,() => openEditor('research',index)));
    });
    container.append(list.childElementCount ? list : node('p','No matching research directions.','empty'));
  } else if (section === 'products') {
    const list=node('div',undefined,'list');
    state.products.map((record,index) => ({record,index})).sort((a,b) => (b.record.date || '').localeCompare(a.record.date || '')).forEach(({record,index}) => { if(matches(record)) list.append(listRow(record.title,[record.type,record.date,record.version].filter(Boolean).join(' · '),record.description,() => openEditor('products',index))); });
    container.append(list.childElementCount ? list : node('p','No products yet. Add software, a dataset, or another research product. A paper is not required.','empty'));
  } else if (section === 'gallery') {
    const cards = node('div', undefined, 'cards');
    state.gallery.map((record,index) => ({record,index})).filter(({record}) => matches(record)).sort((a,b) => b.record.event_date.localeCompare(a.record.event_date)).forEach(({record,index}) => {
      const card = node('article',undefined,'card');
      card.append(record.photos?.length ? photo(record.photos[0].src,record.photos[0].alt) : node('div','No photos yet','card-placeholder'));
      card.append(node('div', record.event_date + ' · ' + record.category, 'row-meta'), node('h3',record.title), node('p',record.description), button('Edit event', () => openEditor('gallery',index)));
      cards.append(card);
    });
    container.append(cards.childElementCount ? cards : node('p','No matching events. Add an event to start an album.','empty'));
  } else {
    const records = state[section].map((record,index) => ({record,index})).filter(({record}) => matches(record));
    records.sort((a,b) => section === 'news' ? b.record.date.localeCompare(a.record.date) : b.record.year - a.record.year);
    const list = node('div',undefined,'list');
    records.forEach(({record,index}) => {
      const metadata = section === 'news' ? record.date+' · '+record.category : record.year+' · '+record.type;
      const description = section === 'news' ? record.text : record.citation;
      list.append(listRow(record.title, metadata, description, () => openEditor(section,index)));
    });
    container.append(records.length ? list : node('p','No matching entries.','empty'));
  }
}
function listRow(title, metadata, description, edit) {
  const row = node('article',undefined,'list-row');
  const copy = node('div',undefined,'row-copy');
  if (metadata) copy.append(node('div',metadata,'row-meta'));
  copy.append(node('h3',title));
  if (description) copy.append(node('p',description.length > 220 ? description.slice(0,217)+'…' : description));
  const editButton = button('Edit',edit);
  editButton.setAttribute('aria-label','Edit '+title);
  row.append(copy, editButton);
  return row;
}
function studentCard(record,index) {
  const card = node('article',undefined,'card');
  card.append(record.photo ? photo(record.photo,record.name,'portrait-preview') : node('div','Photo to be added','card-placeholder'));
  card.append(node('h3',record.name));
  if (record.placeholder) card.append(node('span','Placeholder','placeholder-badge'));
  card.append(node('p',record.role + (record.start_year ? ' · '+record.start_year+'–'+(record.expected_graduation_year ? record.expected_graduation_year+' (expected)' : 'present') : '')));
  if(Array.isArray(record.interests) && record.interests.length) {
    card.append(node('p','Research interests'));
    const badges=node('ul',undefined,'interest-badges'); record.interests.forEach((interest) => badges.append(node('li',interest))); card.append(badges);
  }
  if(record.bio) card.append(node('p',record.bio,'student-bio'));
  card.append(button('Edit student', () => openEditor('students',index)));
  return card;
}
function field(name, label, value = '', options = {}) {
  const wrapper = node('label',undefined,'field'+(options.required ? ' required' : ''));
  wrapper.append(node('span',label));
  let input;
  if (options.select) {
    input = node('select');
    options.select.forEach((entry) => {
      const option = node('option',entry === 'Current' ? 'Teaching' : entry);
      option.value = entry;
      input.append(option);
    });
  } else if (options.multiline) input = node('textarea');
  else {
    input = node('input');
    input.type = options.type || 'text';
  }
  input.name = name;
  input.value = value ?? '';
  if (options.required) input.required = true;
  if (options.placeholder) input.placeholder = options.placeholder;
  if (options.min !== undefined) input.min = options.min;
  if (options.max !== undefined) input.max = options.max;
  if (options.rows) input.rows = options.rows;
  if (options.list) input.setAttribute('list',options.list);
  wrapper.append(input);
  if (options.help) wrapper.append(node('small',options.help));
  return wrapper;
}
function checkbox(name,label,value) {
  const wrapper = node('label',undefined,'field checkbox');
  const input = node('input');
  input.type = 'checkbox'; input.name = name; input.checked = Boolean(value);
  wrapper.append(input,node('span',label));
  return wrapper;
}
function addFields(...fields) { $('#form-fields').append(...fields); }
function studentLinkedIn(record) {
  if(record.linkedin_url) return record.linkedin_url;
  try {
    const url=new URL(record.url || '');
    if(['http:','https:'].includes(url.protocol) && (url.hostname==='linkedin.com' || url.hostname.endsWith('.linkedin.com'))) return record.url;
  } catch (_) {}
  return '';
}
function openEditor(kind,index) {
  const record = ['profile','appearance'].includes(kind) ? state[kind] : index === null ? {} : state[kind][index];
  editing = {kind,index,record,revision:state.revision,photos:structuredClone(record.photos || []),links:structuredClone((kind === 'research' ? record.resources : record.links) || []),photo:(kind === 'profile' ? record.portrait : record.photo) || '',education:structuredClone(record.education || [])};
  dirty = false;
  $('#form-fields').replaceChildren();
  $('#form-error').textContent = '';
  $('#move-student').hidden = kind !== 'students' || index === null;
  $('#delete-entry').hidden = index === null || ['profile','appearance','page_text'].includes(kind);
  $('#delete-entry').textContent = kind === 'gallery' ? 'Delete event' : kind === 'students' || kind === 'alumni' ? 'Delete student' : 'Delete entry';
  $('#form-kicker').textContent = kind === 'alumni' ? 'FORMER STUDENTS' : definitions[kind]?.title || 'STUDENTS';
  $('#form-title').textContent = index === null ? ({products:'Add product',news:'Add news',students:'Add student',alumni:'Add former student',publications:'Add publication',gallery:'Add event',hiring:'Add hiring ad',career:'Add About record',research:'Add research direction',teaching:'Add course',profile:'Edit bio & profile',appearance:'Edit website colors'}[kind]) : 'Edit '+(record.title || record.name);
  if (kind === 'page_text') {
    $('#form-title').textContent='Edit '+(record.title || 'Research detail pages')+' text';
    if (index === 'hiring') addFields(checkbox('notice_enabled','Show hiring popup (once per tab session)',record.notice_enabled !== false));
    Object.entries(record).forEach(([key,value]) => {
      if (key === 'notice_enabled') return;
      const label=({phd_heading:'PhD section heading',phd_empty:'PhD no-openings message',undergraduate_empty:'Undergraduate no-openings message',cv_guidance:'CV guidance',inquiry_link:'Inquiry email link label',title:'Page title',intro:'Page introduction'}[key]) || key.replaceAll('_',' ').replace(/^./,c=>c.toUpperCase());
      const short=key==='title' || key==='greeting' || key.endsWith('_heading') || key.endsWith('_link');
      addFields(field(key,label,value,{multiline:!short,rows:3,required:key==='title' || key==='greeting' || key.endsWith('_heading'),help:short ? undefined : 'Plain text; line breaks are preserved. No HTML is needed.'}));
    });
  } else if (kind === 'appearance') {
    addFields(field('accent','Website color (hex code)',record.accent || record.light_accent || '#4d1979',{required:true,placeholder:'#4d1979',help:'Enter one six-digit hex code. Header, footer, links, buttons, student panels, and dark-mode shades update together.'}));
    const preview=node('div'); addFields(preview);
    function update() {
      const color=form.elements.accent.value.trim();
      if(/^#[0-9a-f]{6}$/i.test(color)) preview.replaceChildren(appearancePreview(paletteFromHex(color)));
    }
    form.elements.accent.addEventListener('input',update); update();
  } else if (kind === 'profile') {
    addFields(field('name','Name',record.name,{required:true}),field('suffix','Degree suffix',record.suffix),field('role','Faculty role',record.role,{required:true}),field('specialty','Specialty',record.specialty),field('institution','University',record.institution,{required:true}),field('institution_url','University website',record.institution_url || 'https://www.tcu.edu/'),field('department','Department',record.department,{required:true}),field('college','College / school',record.college || '',{help:'Shown between department and university on Home and About.'}),field('location','Location',record.location,{required:true}),field('email','Email',record.email,{required:true,type:'email'}),field('phone','Phone',record.phone || '',{type:'tel',help:'Optional. Displayed on the About page.'}),field('office','Office address',record.office,{multiline:true,rows:2}),field('intro','Short research description',record.intro,{required:true,multiline:true,help:'Used for website descriptions and search results.'}),field('home_bio','Home page introduction',record.home_bio.join('\n\n'),{required:true,multiline:true,rows:7,help:'Separate paragraphs with a blank line.'}),field('bio','Full biography on About page',record.bio.join('\n\n'),{required:true,multiline:true,rows:10,help:'Separate paragraphs with a blank line.'}));
    studentPhoto('Profile portrait');
    addFields(node('h3','Public CV'));
    const cvField=field('cv_url','CV link',record.cv_url,{help:'Upload a public PDF below, paste a web link, or leave empty to hide the CV button.'});
    addFields(cvField);
    const cvUpload=node('input'); cvUpload.type='file'; cvUpload.accept='application/pdf'; cvUpload.setAttribute('aria-label','Upload public CV PDF');
    cvUpload.addEventListener('change',async () => {
      const file=cvUpload.files[0]; if (!file) return; setBusy(true);
      try {
        if(file.size>20*1024*1024) throw new Error('Choose a PDF smaller than 20 MB.');
        const uploaded=await request('/api/documents?name='+encodeURIComponent(file.name),{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:file});
        cvField.querySelector('input').value=uploaded.path; dirty=true;
      } catch(error) { $('#form-error').textContent=error.message; }
      finally { setBusy(false); cvUpload.value=''; }
    });
    addFields(cvUpload,node('p','Only upload a CV you want visitors to download.','help'),node('h3','Education'));
    const education=node('div'); education.id='education-entries'; addFields(education); renderEducation();
    addFields(button('Add education',() => { editing.education.push({degree:'',institution:'',year:''}); dirty=true; renderEducation(); },'button secondary'),node('h3','Profile links'));
    const links=node('div'); links.id='event-links'; addFields(links); renderLinks();
    addFields(button('Add profile link',() => { editing.links.push({label:'',url:''}); dirty=true; renderLinks(); },'button secondary'));
  } else if (kind === 'career') {
    addFields(field('group','Category',record.group || 'Professional experience',{required:true,select:['Professional experience','Awards and fellowships','Leadership']}),field('title','Title',record.title,{required:true}),field('period','Dates / period',record.period),field('description','Details',record.description,{required:true,multiline:true,rows:7,help:'These records appear on About. Add activities and appearances through News.'}),field('url','Optional resource link',record.url));
  } else if (kind === 'hiring') {
    addFields(field('title','Position title',record.title,{required:true}),field('group','Student level',record.group || 'PhD',{required:true,select:['PhD','Undergraduate']}),field('status','Status',record.status || 'Open',{required:true,select:['Open','Filled','Closed'],help:'Filled and Closed ads stay visible in the archive with crossed-out titles.'}),field('date','Posted date',record.date || new Date().toLocaleDateString('en-CA'),{required:true,help:'Use YYYY, YYYY-MM, or YYYY-MM-DD.'}),field('deadline','Deadline / review timing (optional)',record.deadline,{placeholder:'Review begins November 15, 2026'}),field('description','Project and position details',record.description,{required:true,multiline:true,rows:7}),field('instructions','How to apply',record.instructions,{required:true,multiline:true,rows:5,help:'Describe eligibility, materials, and submission instructions.'}));
    const flyerField=field('flyer','PDF flier path (optional)',record.flyer,{help:'Upload below. Clear this field to remove the attachment.'});
    const upload=node('input'); upload.type='file'; upload.accept='application/pdf'; upload.setAttribute('aria-label','Upload hiring flier PDF');
    upload.addEventListener('change',async () => {
      const file=upload.files[0]; if(!file) return; setBusy(true);
      try {
        if(file.size>20*1024*1024) throw new Error('Choose a PDF smaller than 20 MB.');
        const result=await request('/api/documents?name='+encodeURIComponent(file.name),{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:file});
        flyerField.querySelector('input').value=result.path; dirty=true;
      } catch(error) { $('#form-error').textContent=error.message; }
      finally {setBusy(false);upload.value='';}
    });
    addFields(flyerField,upload,node('p','Uploaded fliers become public when you publish the website.','help'));
  } else if (kind === 'teaching') {
    addFields(field('title','Course title',record.title,{required:true}),field('institution','Institution',record.institution || state.profile.institution,{required:true,help:'A new institution name automatically creates a teaching panel. Use University · Campus to group campuses together. Your profile institution appears first.'}),field('code','Course code (if available)',record.code,{placeholder:'COSC 50523'}),field('term','Semester / term',record.term,{help:'Required for taught courses; optional for course development.',placeholder:'Fall 2026'}),field('status','Status',record.status || 'Current',{required:true,select:['Current','Past','Developed']}),field('description','Course description',record.description,{required:true,multiline:true,rows:5}),field('url','Syllabus or course material link',record.url,{help:'Use a direct syllabus or relevant university curriculum page.'}),field('url_label','Course link label',record.url_label || 'Course materials',{placeholder:'Syllabus (PDF)'}));
  } else if (kind === 'news') {
    addFields(field('title','Title',record.title,{required:true}), field('date','Date',record.date || new Date().toLocaleDateString('en-CA'),{required:true,help:'Use a year, month, or full date: 2026, 2026-10, or 2026-10-16.'}), field('category','Category',record.category || 'Research',{required:true,list:'news-categories'}));
    const choices = node('datalist'); choices.id = 'news-categories';
    [...new Set(['Research','Proposal submission','Manuscript submission','Activity','Appearance','Publication','Presentation','Visit','Team','Professional service','Teaching',...state.news.map((entry) => entry.category)])].forEach((category) => { const option = node('option'); option.value = category; choices.append(option); });
    addFields(choices,field('text','Update',record.text,{required:true,multiline:true,rows:5}),field('url','Optional link',record.url,{help:'Paste a web address or link to a website page, for example /gallery/agu-2025/.'}));
  } else if (kind === 'products') {
    addFields(field('title','Product name',record.title,{required:true}),field('date','Display date',record.date || '',{help:'Release, update, or associated publication date. Use YYYY, YYYY-MM, or YYYY-MM-DD. Newest appears first; undated entries appear last.',placeholder:'2026-10'}),field('type','Product type',record.type || 'Software',{required:true,select:['Software','Dataset','Other']}),field('description','Description',record.description,{required:true,multiline:true,rows:5}),field('repository_url','Repository URL',record.repository_url),field('pypi_url','PyPI package URL',record.pypi_url || ''),field('dataset_url','Dataset / download URL',record.dataset_url),field('docs_url','Documentation / project website URL',record.docs_url),field('demo_url','Demo URL',record.demo_url),field('version','Version (optional)',record.version),field('license','License (optional)',record.license),node('h3','Related publications (optional)'),node('p','Leave unchecked for products without papers. Papers remain listed in Publications.','help'));
    const related=node('div',undefined,'related-papers');
    state.publications.forEach((publication) => {
      const label=node('label'); const input=node('input'); input.type='checkbox'; input.name='publication_ids'; input.value=publication.id; input.checked=(record.publication_ids || []).includes(publication.id);
      label.append(input,node('span',publication.year+' · '+publication.title)); related.append(label);
    });
    addFields(related);
  } else if (kind === 'publications') {
    addFields(field('title','Title',record.title,{required:true}),field('year','Year',record.year || new Date().getFullYear(),{required:true,type:'number',min:1900,max:2200}),field('type','Publication type',record.type || 'Journal',{required:true,select:['Journal','Conference','Poster','Preprint','Report']}),field('citation','Citation',record.citation,{required:true,multiline:true,rows:5,help:'Authors, venue, year, and other citation details.'}),field('url','Paper, poster, or DOI link',record.url),field('link_label','Optional link label',record.link_label,{placeholder:'Read publication'}),checkbox('featured','Feature this publication on the home page',record.featured));
  } else if (kind === 'students') {
    addFields(field('name','Name',record.name,{required:true}),field('group','Group',record.group || 'Undergraduate researchers',{required:true,select:['PhD students','Undergraduate researchers','Collaborators']}),field('role','Role / degree',record.role,{required:true,placeholder:'PhD student in Computer Science'}),field('start_year','Start year',record.start_year || '',{placeholder:'2026',help:'Four-digit year. Dates appear beside the role.'}),field('expected_graduation_year','Expected graduation year',record.expected_graduation_year || '',{placeholder:'2031',help:'Leave blank to display present.'}),field('bio','Short biography',record.bio || (typeof record.interests==='string' ? record.interests : ''),{multiline:true,rows:6,help:'Write a paragraph about the student, their background, projects, and research interests.'}),field('interests','Research-interest badges',Array.isArray(record.interests) ? record.interests.join('\n') : '',{multiline:true,rows:4,help:'One short topic per line, for example Explainable AI or Space weather. Up to 20 badges, 120 characters each.'}),field('url','Optional personal website or LinkedIn',record.url),field('linkedin_url','LinkedIn URL',studentLinkedIn(record),{help:'Transferred automatically when you move this student to Former students. Leave blank if unavailable.'}),checkbox('placeholder','This is a placeholder profile',record.placeholder));
    studentPhoto();
  } else if (kind === 'alumni') {
    addFields(field('name','Name',record.name,{required:true}),field('linkedin_url','LinkedIn link (optional)',record.linkedin_url));
  } else if (kind === 'research') {
    addFields(field('title','Research title',record.title,{required:true}),field('label','Topic label',record.label,{required:true,placeholder:'Explainable AI'}),field('number','Display order',Number(record.number) || state.research.length+1,{type:'number',required:true,min:1,max:99}),field('short','Summary on research cards',record.short,{required:true,multiline:true,rows:2}),field('intro','Page introduction',record.intro,{required:true,multiline:true,rows:3}),field('question','Research question',record.question,{required:true,multiline:true,rows:2}),field('body','Detailed description',record.body,{multiline:true,rows:8,help:'Write paragraphs normally. Markdown formatting is optional.'}),field('focus','Areas of focus',(record.focus || []).join('\n'),{required:true,multiline:true,rows:4,help:'One focus area per line.'}));
    addFields(node('h3','Research illustration'));
    editing.image=record.image || '';
    const preview=node('div');
    if (editing.image) preview.append(photo(editing.image,'Research illustration','photo-preview'));
    const imageInput=node('input'); imageInput.type='file'; imageInput.accept='image/jpeg,image/png,image/webp,image/gif,image/svg+xml,.svg'; imageInput.setAttribute('aria-label','Upload research illustration');
    imageInput.addEventListener('change',async () => {
      if (!imageInput.files[0]) return;
      setBusy(true);
      try { editing.image=(await uploadPhoto(imageInput.files[0])).path; dirty=true; preview.replaceChildren(photo(editing.image,'Research illustration','photo-preview')); }
      catch(error) { $('#form-error').textContent=error.message; }
      finally { setBusy(false); imageInput.value=''; }
    });
    addFields(preview,imageInput,field('image_alt','Illustration description',record.image_alt,{required:true,help:'Describe the image for screen readers. Also used as the visible caption if the caption field is blank.'}),field('image_caption','Visible image caption (optional)',record.image_caption || '',{multiline:true,rows:2,help:'Shown below the image on the research page. Leave blank to use the image description above.'}),node('h3','Related publications'));
    const related=node('div',undefined,'related-papers');
    state.publications.forEach((publication) => {
      const label=node('label'); const input=node('input'); input.type='checkbox'; input.name='publication_ids'; input.value=publication.id; input.checked=(record.publication_ids || []).includes(publication.id);
      label.append(input,node('span',publication.year+' · '+publication.title)); related.append(label);
    });
    addFields(related,node('h3','Code, datasets, and other resource links'));
    const links=node('div'); links.id='event-links'; addFields(links); renderLinks();
    addFields(button('Add resource link',() => { editing.links.push({label:'',url:''}); dirty=true; renderLinks(); },'button secondary'));
  } else if (kind === 'gallery') {
    addFields(field('title','Event title',record.title,{required:true}),field('event_date','Event date',record.event_date || new Date().toLocaleDateString('en-CA'),{required:true,help:'Use 2026, 2026-10, or 2026-10-16.'}),field('category','Event type',record.category || 'Team activity',{required:true,placeholder:'Presentation, visit, conference, or team activity'}),field('location','Location',record.location),field('description','Short summary',record.description,{required:true,multiline:true,rows:2}),field('body','Event notes',record.body,{multiline:true,rows:5,help:'Write paragraphs normally. Markdown formatting is optional.'}));
    addFields(node('h3','Event photos'),node('p','The first photo is the album cover. Use Move up to change the cover.','help'));
    const photoList = node('div'); photoList.id = 'album-photos'; addFields(photoList);
    const tools = node('div',undefined,'photo-tools');
    const uploadLabel = node('label'); uploadLabel.append(node('span','Add photos (JPEG, PNG, WebP, GIF, or SVG; up to 20 MB each)'));
    const input = node('input'); input.type='file'; input.accept='image/jpeg,image/png,image/webp,image/gif,image/svg+xml,.svg'; input.multiple=true;
    input.addEventListener('change',async () => {
      if (!input.files.length) return;
      setBusy(true);
      try {
        for (const file of input.files) {
          const uploaded = await uploadPhoto(file);
          editing.photos.push({src:uploaded.path,alt:'',caption:''});
        }
        dirty=true; renderPhotos();
      } catch (error) { $('#form-error').textContent=error.message; }
      finally { setBusy(false); input.value=''; }
    });
    uploadLabel.append(input); tools.append(uploadLabel); addFields(tools); renderPhotos();
    addFields(node('h3','Related papers, posters, or reports'));
    const related=node('div',undefined,'related-papers');
    state.publications.forEach((publication) => {
      const label=node('label'); const input=node('input'); input.type='checkbox'; input.name='publication_ids'; input.value=publication.id; input.checked=(record.publication_ids || []).includes(publication.id);
      label.append(input,node('span',publication.year+' · '+publication.title)); related.append(label);
    });
    addFields(related,node('h3','Recordings and other links'));
    const links=node('div'); links.id='event-links'; addFields(links); renderLinks();
    addFields(button('Add link',() => { editing.links.push({label:'',url:''}); dirty=true; renderLinks(); },'button secondary'));
  }
  dialog.showModal();
  $('#form-fields input, #form-fields textarea, #form-fields select')?.focus();
}
async function uploadPhoto(file) {
  if (file.size > 20*1024*1024) throw new Error('Please choose an image smaller than 20 MB.');
  return request('/api/photos?name='+encodeURIComponent(file.name),{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:file});
}
function studentPhoto(label = 'Student photo') {
  addFields(node('h3',label));
  const preview=node('div'); preview.id='student-photo-preview';
  if (editing.photo) preview.append(photo(editing.photo,'Student photo','photo-preview'));
  const upload=node('input'); upload.type='file'; upload.accept='image/jpeg,image/png,image/webp,image/gif,image/svg+xml,.svg'; upload.setAttribute('aria-label','Upload '+label.toLowerCase());
  upload.addEventListener('change',async () => {
    if (!upload.files[0]) return;
    setBusy(true);
    try {
      editing.photo=(await uploadPhoto(upload.files[0])).path; dirty=true;
      preview.replaceChildren(photo(editing.photo,'Student photo','photo-preview'));
    } catch (error) { $('#form-error').textContent=error.message; }
    finally { setBusy(false); upload.value=''; }
  });
  addFields(preview,upload,button('Remove photo',() => { editing.photo=''; preview.replaceChildren(); dirty=true; },'delete-button'));
}
function renderPhotos() {
  const list=$('#album-photos'); list.replaceChildren();
  editing.photos.forEach((item,index) => {
    const row=node('div',undefined,'photo-row'); const top=node('div',undefined,'photo-row-top');
    const actions=node('div');
    if (index > 0) actions.append(button('Move up',() => { [editing.photos[index-1],editing.photos[index]]=[editing.photos[index],editing.photos[index-1]]; dirty=true; renderPhotos(); }));
    actions.append(button('Remove',() => { editing.photos.splice(index,1); dirty=true; renderPhotos(); },'delete-button'));
    top.append(photo(item.src,item.alt || 'Uploaded event photo','photo-preview'),actions);
    const alt=field('photo_alt_'+index,'Image description',item.alt,{required:true,help:'Describe the people and activity for visitors using screen readers.'});
    alt.querySelector('input').addEventListener('input',(event) => { item.alt=event.target.value; });
    const caption=field('photo_caption_'+index,'Caption / photo credit',item.caption);
    caption.querySelector('input').addEventListener('input',(event) => { item.caption=event.target.value; });
    row.append(top,alt,caption); list.append(row);
  });
}
function renderEducation() {
  const container=$('#education-entries'); container.replaceChildren();
  editing.education.forEach((item,index) => {
    const row=node('div',undefined,'link-row');
    [['degree','Degree'],['institution','Institution'],['year','Year']].forEach(([name,label]) => {
      const wrapper=field('education_'+name+'_'+index,label,item[name],{required:true});
      wrapper.querySelector('input').addEventListener('input',(event) => { item[name]=event.target.value; });
      row.append(wrapper);
    });
    row.append(button('Remove education',() => { editing.education.splice(index,1); dirty=true; renderEducation(); },'delete-button')); container.append(row);
  });
}
function renderLinks() {
  const list=$('#event-links'); list.replaceChildren();
  editing.links.forEach((item,index) => {
    const row=node('div',undefined,'link-row');
    const label=field('link_label_'+index,'Link label',item.label,{required:true}); label.querySelector('input').addEventListener('input',(event) => { item.label=event.target.value; });
    const url=field('link_url_'+index,'Web address',item.url,{required:true}); url.querySelector('input').addEventListener('input',(event) => { item.url=event.target.value; });
    row.append(label,url,button('Remove link',() => { editing.links.splice(index,1); dirty=true; renderLinks(); },'delete-button')); list.append(row);
  });
}
function setBusy(value) {
  busy=value;
  $('#save-entry').disabled=value;
  $('#delete-entry').disabled=value;
  $('#move-student').disabled=value;
  $('#cancel-entry').disabled=value;
  $('#close-dialog').disabled=value;
  $('#save-entry').textContent=value ? 'Working…' : 'Save locally';
}
function closeEditor() {
  if (busy) return;
  if (dirty && !confirm('Discard the changes in this form? Uploaded photos remain in the website folder.')) return;
  dialog.close(); editing=null; dirty=false;
}
form.addEventListener('input',() => { dirty=true; });
form.addEventListener('change',() => { dirty=true; });
form.addEventListener('submit',async (event) => {
  event.preventDefault(); if (busy) return;
  const values=new FormData(form); const record={};
  values.forEach((value,key) => { if (!key.startsWith('education_') && !key.startsWith('photo_') && !key.startsWith('link_label_') && !key.startsWith('link_url_') && key !== 'publication_ids') record[key]=value; });
  if (editing.kind === 'page_text' && editing.index === 'hiring') record.notice_enabled=values.has('notice_enabled');
  if (editing.kind === 'profile') { record.portrait=editing.photo; record.recruiting=state.profile.recruiting; record.recruiting_text=state.profile.recruiting_text; record.home_bio=String(record.home_bio || '').split(/\n\s*\n/).map((value) => value.trim()).filter(Boolean); record.bio=String(record.bio || '').split(/\n\s*\n/).map((value) => value.trim()).filter(Boolean); record.education=editing.education; record.links=editing.links; }
  if (editing.kind === 'products') record.publication_ids=values.getAll('publication_ids');
  if (editing.kind === 'publications') record.featured=values.has('featured');
  if (editing.kind === 'students') { record.interests=String(record.interests || '').split('\n').map((value) => value.trim()).filter(Boolean); record.placeholder=values.has('placeholder'); record.photo=editing.photo; }
  if (editing.kind === 'research') { record.image=editing.image; record.focus=String(record.focus || '').split('\n').map((value) => value.trim()).filter(Boolean); record.publication_ids=values.getAll('publication_ids'); record.resources=editing.links; }
  if (editing.kind === 'gallery') { record.photos=editing.photos; record.links=editing.links; record.publication_ids=values.getAll('publication_ids'); }
  setBusy(true); $('#form-error').textContent='';
  try {
    state=await request('/api/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:editing.kind,index:editing.index,record,revision:editing.revision})});
    dirty=false; dialog.close(); render(); message('Saved locally. Refresh the website preview to review your change, then commit and push when ready.');
  } catch (error) { $('#form-error').textContent=error.message; }
  finally { setBusy(false); }
});
$('#move-student').addEventListener('click',async () => {
  if(busy || editing?.kind!=='students' || editing.index===null) return;
  const name=form.elements.name.value.trim();
  const linkedin=form.elements.linkedin_url.value.trim();
  if(!name) { $('#form-error').textContent='Enter the student’s name before moving them.'; return; }
  if(!confirm('Move '+name+' to Former students? Their name and LinkedIn link will be retained, and their active profile will be removed. A local backup will be kept.')) return;
  setBusy(true); $('#form-error').textContent='';
  try {
    state=await request('/api/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'move_student',index:editing.index,record:{name,linkedin_url:linkedin},revision:editing.revision})});
    dirty=false; dialog.close(); render(); message(name+' moved to Former students. Their active profile was removed; a local backup was kept.');
  } catch(error) { $('#form-error').textContent=error.message; }
  finally { setBusy(false); }
});
$('#delete-entry').addEventListener('click',async () => {
  if (busy || !confirm('Delete this entry from the local website? A backup will be kept.')) return;
  setBusy(true); $('#form-error').textContent='';
  try {
    state=await request('/api/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:editing.kind,index:editing.index,delete:true,revision:editing.revision})});
    dirty=false; dialog.close(); render(); message('Entry deleted locally. A backup has been kept; nothing was pushed to GitHub.');
  } catch (error) { $('#form-error').textContent=error.message; }
  finally { setBusy(false); }
});
$('#add-entry').addEventListener('click',() => openEditor(section,section === 'page_text' ? 'index' : null));
$('#reload').addEventListener('click',async () => { await load(); message('Content reloaded from the website folder.'); });
$('#search').addEventListener('input',render);
$('#close-dialog').addEventListener('click',closeEditor);
$('#cancel-entry').addEventListener('click',closeEditor);
dialog.addEventListener('cancel',(event) => { event.preventDefault(); closeEditor(); });
document.querySelectorAll('[data-section]').forEach((item) => item.addEventListener('click',() => { section=item.dataset.section; $('#search').value=''; message(''); render(); }));
window.addEventListener('beforeunload',(event) => { if (dialog.open && dirty) { event.preventDefault(); event.returnValue=''; } });
load();
