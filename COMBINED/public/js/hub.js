(function(){
  const sock = io('/'); // root for leaderboard broadcast
  const nameInput = document.getElementById('playerName');
  const saveBtn = document.getElementById('saveName');
  const pointsEl = document.getElementById('points');
  const leaderboardList = document.getElementById('leaderboardList');

  let profile = null;

  function renderLeaderboard(list){
    leaderboardList.innerHTML = '';
    list.forEach((row, idx)=>{
      const li = document.createElement('li');
      li.textContent = `${idx+1}. ${row.name} — ${row.points}`;
      leaderboardList.appendChild(li);
    });
  }

  function initProfile(){
    const n = localStorage.getItem('casino:name') || '';
    nameInput.value = n;
    sock.emit('profile:init', n);
  }

  saveBtn.addEventListener('click', () => {
    const n = nameInput.value.trim();
    localStorage.setItem('casino:name', n);
    sock.emit('profile:init', n);
  });

  sock.on('connect', initProfile);
  sock.on('profile', (p)=>{ profile = p; pointsEl.textContent = p.points; });
  sock.on('leaderboard:update', (rows)=>{ renderLeaderboard(rows); if (profile) { pointsEl.textContent = profile.points; } });
})();
