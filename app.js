// app.js — स्कूल मैनेजमेंट सिस्टम (हिंदी) - client-only with localStorage
(() => {
  // Helpers
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  const uid = () => 'id_' + Math.random().toString(36).slice(2,9);

  // Keys for localStorage
  const LS_KEYS = {
    students: 'sms_students_v1',
    teachers: 'sms_teachers_v1',
    timetable: 'sms_timetable_v1',
    attendance: 'sms_attendance_v1',
    fees: 'sms_fees_v1'
  };

  // Loaders
  const load = (k, def=[]) => {
    try {
      return JSON.parse(localStorage.getItem(k) || 'null') || def;
    } catch(e){ return def; }
  };
  const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  // State
  let students = load(LS_KEYS.students, []);
  let teachers = load(LS_KEYS.teachers, []);
  let timetable = load(LS_KEYS.timetable, []);
  let attendance = load(LS_KEYS.attendance, {}); // { "2025-12-01": { studentId: "present"/"absent" } }
  let fees = load(LS_KEYS.fees, []);

  // UI refs
  const tabs = $$('.nav-btn');
  const tabSections = $$('.tab');
  const yearSpan = $('#year');
  if (yearSpan) yearSpan.textContent = new Date().getFullYear();

  // Dashboard stats
  function refreshStats(){
    $('#statStudents').textContent = `छात्र: ${students.length}`;
    $('#statTeachers').textContent = `शिक्षक: ${teachers.length}`;
    const todayKey = (new Date()).toISOString().slice(0,10);
    const todayAtt = attendance[todayKey];
    $('#statTodayAttVal').textContent = todayAtt ? `${Object.values(todayAtt).filter(v=>v==='present').length} उपस्थित / ${Object.keys(todayAtt).length}` : 'निरस्त';
  }

  // Navigation
  tabs.forEach(b => b.addEventListener('click', () => {
    tabs.forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    const tab = b.dataset.tab;
    tabSections.forEach(s => {
      if (s.id === tab) s.classList.add('active'); else s.classList.remove('active');
    });
    if (tab === 'students') renderStudents();
    if (tab === 'attendance') prepareAttendance();
    if (tab === 'teachers') renderTeachers();
    if (tab === 'timetable') renderTimetable();
    if (tab === 'fees') renderFees();
    refreshStats();
  }));

  // ---------- STUDENTS ----------
  const studentForm = $('#studentForm');
  const s_id = $('#s_id'), s_name = $('#s_name'), s_class = $('#s_class'), s_gender = $('#s_gender'), s_roll = $('#s_roll');
  const studentsList = $('#studentsList');
  const studentSearch = $('#studentSearch');
  const studentFormReset = $('#studentFormReset');

  function resetStudentForm(){
    s_id.value = '';
    s_name.value = ''; s_class.value=''; s_gender.value='लड़का'; s_roll.value='';
    $('#studentFormTitle').textContent = 'नया छात्र जोड़ें';
  }

  studentForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = s_name.value.trim();
    const cls = s_class.value.trim();
    const gender = s_gender.value;
    const roll = s_roll.value.trim();
    if (!name || !cls || !roll) {
      alert('कृपया सभी अनिवार्य फ़ील्ड भरें।');
      return;
    }
    if (s_id.value) {
      // edit
      const idx = students.findIndex(s => s.id === s_id.value);
      if (idx >= 0) {
        students[idx] = { ...students[idx], name, class: cls, gender, roll: Number(roll) };
        save(LS_KEYS.students, students);
        resetStudentForm();
        renderStudents();
        refreshStats();
        alert('छात्र अपडेट कर दिया गया।');
      }
    } else {
      // add
      const newS = { id: uid(), name, class: cls, gender, roll: Number(roll), grades: {} };
      students.push(newS);
      save(LS_KEYS.students, students);
      resetStudentForm();
      renderStudents();
      refreshStats();
      alert('छात्र जुड़ा गया।');
    }
  });

  studentFormReset.addEventListener('click', resetStudentForm);

  function renderStudents(filter=''){
    studentsList.innerHTML = '';
    const f = filter.trim().toLowerCase();
    const list = students.filter(s => {
      if (!f) return true;
      return s.name.toLowerCase().includes(f) || (s.class||'').toLowerCase().includes(f) || (s.roll||'').toString().includes(f);
    }).sort((a,b)=>a.roll - b.roll);
    if (list.length === 0) {
      studentsList.innerHTML = `<div class="muted">कोई छात्र नहीं मिला।</div>`;
      return;
    }
    list.forEach(s => {
      const div = document.createElement('div'); div.className = 'item';
      div.innerHTML = `
        <div class="meta">
          <div><strong>${s.name}</strong><br><small>कक्षा: ${s.class} • रोल: ${s.roll} • ${s.gender}</small></div>
        </div>
        <div class="actions">
          <button class="btn ghost btn-edit" data-id="${s.id}">संपादित</button>
          <button class="btn ghost btn-att" data-id="${s.id}">उपस्थिति</button>
          <button class="btn ghost btn-gr" data-id="${s.id}">अंक</button>
          <button class="btn" style="background:#ff7675;color:#fff" data-id="${s.id}" id="del_${s.id}">हटाएँ</button>
        </div>
      `;
      studentsList.appendChild(div);

      div.querySelector('.btn-edit').addEventListener('click', () => {
        s_id.value = s.id;
        s_name.value = s.name;
        s_class.value = s.class;
        s_gender.value = s.gender;
        s_roll.value = s.roll;
        $('#studentFormTitle').textContent = 'छात्र संपादित करें';
        window.scrollTo({top:0, behavior:'smooth'});
      });

      div.querySelector('.btn-att').addEventListener('click', () => {
        // open attendance tab with this student's row preselected
        document.querySelector('[data-tab="attendance"]').click();
        setTimeout(()=>{
          const today = new Date().toISOString().slice(0,10);
          $('#att_date').value = today;
          loadAttendanceForDate(today, s.id);
        }, 50);
      });

      div.querySelector('.btn-gr').addEventListener('click', () => {
        // manage grades modal (simple prompt)
        const subject = prompt('किस विषय के लिए अंक जोड़ें/अद्यतन करें? (उदा: गणित)');
        if (!subject) return;
        const mark = prompt('अंक दर्ज करें (0-100):');
        const n = Number(mark);
        if (isNaN(n) || n < 0 || n > 100) { alert('कृपया 0-100 के बीच अंक दें।'); return; }
        s.grades = s.grades || {};
        s.grades[subject] = n;
        save(LS_KEYS.students, students);
        alert('अंक सहेज दिए गए।');
      });

      div.querySelector(`#del_${s.id}`).addEventListener('click', () => {
        if (!confirm(`${s.name} को हटाना चाहते हैं?`)) return;
        students = students.filter(x => x.id !== s.id);
        save(LS_KEYS.students, students);
        renderStudents();
        refreshStats();
      });
    });
  }

  studentSearch.addEventListener('input', (e)=> renderStudents(e.target.value));

  // ---------- ATTENDANCE ----------
  const attDate = $('#att_date');
  const loadAttendanceBtn = $('#loadAttendance');
  const attendanceContainer = $('#attendanceContainer');
  const attendanceMsg = $('#attendanceMsg');

  function prepareAttendance(){
    const today = (new Date()).toISOString().slice(0,10);
    attDate.value = today;
    attendanceContainer.innerHTML = '';
    attendanceMsg.textContent = 'कृपया दिनांक चुनें और "देखें / बनाएं" पर क्लिक करें।';
  }

  loadAttendanceBtn.addEventListener('click', () => {
    const date = attDate.value;
    if (!date) return alert('कृपया दिनांक चुनें।');
    loadAttendanceForDate(date);
  });

  function loadAttendanceForDate(date, highlightStudentId){
    attendanceContainer.innerHTML = '';
    attendanceMsg.textContent = '';
    // ensure record exists
    attendance[date] = attendance[date] || {};
    // render student list with toggles
    const list = students.slice().sort((a,b)=>a.roll - b.roll);
    if (list.length === 0) {
      attendanceContainer.innerHTML = '<div class="muted">कोई छात्र उपलब्ध नहीं है। पहले छात्र जोड़ें।</div>';
      return;
    }
    list.forEach(s => {
      const row = document.createElement('div'); row.className = 'item';
      row.innerHTML = `
        <div><strong>${s.name}</strong><br><small>कक्षा: ${s.class} • रोल: ${s.roll}</small></div>
        <div>
          <select class="att-select" data-id="${s.id}">
            <option value="present">उपस्थित</option>
            <option value="absent">अनुपस्थित</option>
          </select>
        </div>
      `;
      attendanceContainer.appendChild(row);
      const select = row.querySelector('select');
      // set from stored
      select.value = attendance[date][s.id] || 'absent';
      // highlight if requested
      if (highlightStudentId && s.id === highlightStudentId) {
        row.style.boxShadow = '0 6px 20px rgba(11,134,255,0.08)';
      }
      select.addEventListener('change', () => {
        attendance[date][s.id] = select.value;
        save(LS_KEYS.attendance, attendance);
        attendanceMsg.textContent = `उपस्थिति सहेजी गई (${date})`;
        refreshStats();
      });
    });
    // summary button
    const summaryBtn = document.createElement('div'); summaryBtn.className='row';
    summaryBtn.innerHTML = `<button class="btn ghost" id="calcSummary">उपस्थिति सारांश देखें</button>`;
    attendanceContainer.appendChild(summaryBtn);
    $('#calcSummary').addEventListener('click', () => {
      const presentCount = Object.values(attendance[date]).filter(v=>v==='present').length;
      alert(`${date} के लिए: ${presentCount} उपस्थित, ${students.length - presentCount} अनुपस्थित`);
    });
  }

  // ---------- TEACHERS ----------
  const teacherForm = $('#teacherForm');
  const t_id = $('#t_id'), t_name = $('#t_name'), t_subject = $('#t_subject');
  const teachersList = $('#teachersList');
  const teacherFormReset = $('#teacherFormReset');

  function resetTeacherForm(){ t_id.value=''; t_name.value=''; t_subject.value=''; $('#teacherFormTitle').textContent='नया शिक्षक जोड़ें'; }

  teacherForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = t_name.value.trim(), subject = t_subject.value.trim();
    if (!name || !subject) { alert('सभी फ़ील्ड भरें'); return; }
    if (t_id.value) {
      const idx = teachers.findIndex(x=>x.id===t_id.value);
      if (idx>=0){ teachers[idx] = {...teachers[idx], name, subject}; save(LS_KEYS.teachers, teachers); resetTeacherForm(); renderTeachers(); refreshStats(); alert('शिक्षक अपडेट हुआ।'); }
    } else {
      teachers.push({ id: uid(), name, subject });
      save(LS_KEYS.teachers, teachers);
      resetTeacherForm();
      renderTeachers();
      refreshStats();
      alert('शिक्षक जुड़ा गया।');
    }
  });

  teacherFormReset.addEventListener('click', resetTeacherForm);

  function renderTeachers(){
    teachersList.innerHTML = '';
    if (teachers.length === 0) { teachersList.innerHTML = '<div class="muted">कोई शिक्षक नहीं है।</div>'; return; }
    teachers.forEach(t => {
      const div = document.createElement('div'); div.className='item';
      div.innerHTML = `<div><strong>${t.name}</strong><br><small>विषय: ${t.subject}</small></div>
        <div>
          <button class="btn ghost btn-te-edit" data-id="${t.id}">संपादित</button>
          <button class="btn" style="background:#ff7675;color:#fff" data-id="${t.id}">हटाएँ</button>
        </div>`;
      teachersList.appendChild(div);
      div.querySelector('.btn-te-edit').addEventListener('click', ()=> {
        t_id.value = t.id; t_name.value = t.name; t_subject.value = t.subject; $('#teacherFormTitle').textContent='शिक्षक संपादित करें'; window.scrollTo({top:0,behavior:'smooth'});
      });
      div.querySelector('button[style]').addEventListener('click', () => {
        if (!confirm(`क्या आप ${t.name} को हटाना चाहते हैं?`)) return;
        teachers = teachers.filter(x=>x.id !== t.id);
        save(LS_KEYS.teachers, teachers);
        renderTeachers(); refreshStats();
      });
    });
  }

  // ---------- TIMETABLE ----------
  const ttForm = $('#ttForm');
  const ttList = $('#ttList');
  const ttReset = $('#ttReset');

  ttForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const cls = $('#tt_class').value.trim();
    const day = $('#tt_day').value;
    const subject = $('#tt_subject').value.trim();
    const time = $('#tt_time').value.trim();
    if (!cls || !subject || !time) return alert('सभी फ़ील्ड भरें।');
    timetable.push({ id: uid(), class: cls, day, subject, time });
    save(LS_KEYS.timetable, timetable);
    ttForm.reset();
    renderTimetable();
  });

  ttReset.addEventListener('click', ()=> ttForm.reset());

  function renderTimetable(){
    ttList.innerHTML = '';
    if (timetable.length === 0) { ttList.innerHTML = '<div class="muted">कोई समय सारिणी नहीं।</div>'; return; }
    timetable.forEach(t => {
      const div = document.createElement('div'); div.className='item';
      div.innerHTML = `<div><strong>${t.class} — ${t.day}</strong><br><small>${t.subject} • ${t.time}</small></div>
        <div>
          <button class="btn ghost btn-tt-del" data-id="${t.id}">हटाएँ</button>
        </div>`;
      ttList.appendChild(div);
      div.querySelector('.btn-tt-del').addEventListener('click', ()=> {
        if (!confirm('क्या हटाना चाहते हैं?')) return;
        timetable = timetable.filter(x=>x.id !== t.id);
        save(LS_KEYS.timetable, timetable);
        renderTimetable();
      });
    });
  }

  // ---------- FEES ----------
  const feeForm = $('#feeForm');
  const feesListEl = $('#feesList');
  const feeReset = $('#feeReset');

  feeForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const roll = $('#f_roll').value.trim();
    const amount = Number($('#f_amount').value);
    const date = $('#f_date').value;
    const note = $('#f_note').value.trim();
    if (!roll || !amount || !date) return alert('सभी अनिवार्य फ़ील्ड भरें।');
    fees.push({ id: uid(), roll: Number(roll), amount, date, note });
    save(LS_KEYS.fees, fees);
    feeForm.reset();
    renderFees();
    alert('फीस रिकॉर्ड सहेजा गया।');
  });

  feeReset.addEventListener('click', ()=> feeForm.reset());

  function renderFees(){
    feesListEl.innerHTML = '';
    if (fees.length === 0) { feesListEl.innerHTML = '<div class="muted">कोई फीस रिकॉर्ड नहीं।</div>'; return; }
    fees.slice().reverse().forEach(f => {
      const div = document.createElement('div'); div.className='item';
      const student = students.find(s=>s.roll === f.roll);
      div.innerHTML = `<div><strong>रोल ${f.roll} ${student ? '— ' + student.name : ''}</strong><br><small>राशि: ₹${f.amount} • तिथि: ${f.date} • ${f.note || ''}</small></div>
        <div><button class="btn ghost btn-fee-del" data-id="${f.id}">हटाएँ</button></div>`;
      feesListEl.appendChild(div);
      div.querySelector('.btn-fee-del').addEventListener('click', ()=> {
        if (!confirm('क्या आप फीस रिकॉर्ड हटाना चाहते हैं?')) return;
        fees = fees.filter(x=>x.id !== f.id);
        save(LS_KEYS.fees, fees);
        renderFees();
      });
    });
  }

  // ---------- Utilities ----------
  $('#resetData').addEventListener('click', () => {
    if (!confirm('सारे स्थानीय डेटा को हटाया जाएगा। जारी रखें?')) return;
    localStorage.removeItem(LS_KEYS.students);
    localStorage.removeItem(LS_KEYS.teachers);
    localStorage.removeItem(LS_KEYS.timetable);
    localStorage.removeItem(LS_KEYS.attendance);
    localStorage.removeItem(LS_KEYS.fees);
    students = []; teachers = []; timetable = []; attendance = {}; fees = [];
    renderAll();
  });

  function renderAll(){
    renderStudents();
    renderTeachers();
    renderTimetable();
    renderFees();
    prepareAttendance();
    refreshStats();
  }

  // Initial render
  renderAll();

  // Quick sample data if empty (for demo). Only add on first load to help user test.
  (function seedIfEmpty(){
    if (students.length === 0 && teachers.length === 0 && timetable.length === 0 && fees.length === 0) {
      // small prompt to user if they want demo data
      if (confirm('क्या आप डेमो डेटा (नमूना) जोड़ना चाहेंगे?')) {
        students = [
          { id: uid(), name:'आर्यन कुमार', class:'5A', gender:'लड़का', roll:1, grades:{'गणित':78,'हिन्दी':85} },
          { id: uid(), name:'स्मृति वर्मा', class:'5A', gender:'लड़की', roll:2, grades:{'गणित':88,'हिन्दी':90} },
          { id: uid(), name:'राहुल ', class:'6B', gender:'लड़का', roll:10, grades:{} }
        ];
        teachers = [
          { id: uid(), name:'श्रीमती राधा', subject:'हिन्दी' },
          { id: uid(), name:'मोहित शर्मा', subject:'गणित' }
        ];
        timetable = [
          { id: uid(), class:'5A', day:'सोमवार', subject:'गणित', time:'08:30 - 09:15' },
          { id: uid(), class:'5A', day:'सोमवार', subject:'हिन्दी', time:'09:15 - 10:00' }
        ];
        const today = (new Date()).toISOString().slice(0,10);
        attendance = { [today]: { [students[0].id]: 'present', [students[1].id]:'present', [students[2].id]:'absent' } };
        fees = [{ id: uid(), roll:1, amount:1000, date:today, note:'जनवरी' }];
        save(LS_KEYS.students, students);
        save(LS_KEYS.teachers, teachers);
        save(LS_KEYS.timetable, timetable);
        save(LS_KEYS.attendance, attendance);
        save(LS_KEYS.fees, fees);
        renderAll();
        alert('डेमो डेटा जुड़ गया।');
      }
    }
  })();

})();
