(function(){
  const sock = io('/poker');
  const root = io('/');
  const app = document.getElementById('app');
  let profile=null; let currentRoom=null; let state=null; let isHost=false;

  function header(){
    return `<div class="section"><div class="flex" style="justify-content:space-between"><div><input id="pkName" placeholder="Your name" maxlength="20" style="padding:.4rem;border-radius:6px;border:1px solid #4a5568;background:#1a202c;color:#fff"/><button id="pkSave" class="btn">Save</button></div><div>Points: <span id="pts">${profile?profile.points:'-'}</span></div></div></div>`;
  }

  function lobby(){
    return `<div class="section"><div class="flex"><button id="create" class="btn">Create Room</button><input id="roomId" placeholder="Room ID" maxlength="6" style="padding:.4rem;border-radius:6px;border:1px solid #4a5568;background:#1a202c;color:#fff"/><button id="join" class="btn">Join</button></div><div class="status">${state?('Room: '+state.roomId):'No room'}</div><div id="players" class="flex"></div><div class="flex"><button id="start" class="btn">Start</button></div></div>`;
  }

  function community(){
    const cards = (state?.communityCards||[]).map(cardEl).join('');
    return `<div class="section"><div style="font-weight:600;margin-bottom:.5rem">Community</div><div class="flex">${cards}</div><div>Pot: $${state?state.pot:0} | ${state?formatRound(state.round):''}</div></div>`;
  }

  function players(){
    if (!state) return '';
    const html = state.players.map((p,i)=>{
      const cardsHtml = p.isBot ? '<div class="card card-back">🂠</div><div class="card card-back">🂠</div>' : (p.cards||[]).map(cardEl).join('');
      return `<div class="section"><div style="display:flex;justify-content:space-between"><div>${p.name}${i===state.currentPlayer?' (turn)':''}</div><div>$${p.balance} | Bet: $${p.currentBet}</div></div><div class="flex">${cardsHtml}</div>${p.folded?'<div class="status" style="color:#f44336">FOLDED</div>':''}</div>`;
    }).join('');
    return `<div class="grid">${html}</div>`;
  }

  function controls(){
    if (!state) return '';
    const me = state.players.find(p=>p.id===sock.id);
    const myTurn = state.players[state.currentPlayer]?.id===sock.id;
    let html = '<div class="section">';
    if (state.gameState==='waiting'){
      html += `<div class="status">Waiting in lobby...</div>`;
    } else if (state.gameState==='playing'){
      html += `<div class="flex"><button id="fold" class="btn" ${!myTurn||me?.folded?'disabled':''}>Fold</button><button id="check" class="btn" ${!myTurn||me?.folded?'disabled':''}>Check</button><button id="call" class="btn" ${!myTurn||me?.folded?'disabled':''}>Call</button><input id="raiseAmt" type="number" min="${state.currentBet}" max="${me?me.balance:0}" style="padding:.4rem;border-radius:6px;border:1px solid #4a5568;background:#1a202c;color:#fff;width:100px"/><button id="raise" class="btn" ${!myTurn||me?.folded?'disabled':''}>Raise</button></div>`;
    } else if (state.gameState==='finished'){
      html += '<div class="status">Hand finished. Returning to lobby...</div>';
    }
    html += '</div>';
    return html;
  }

  function cardEl(c){
    const red = (c.suit==='♥'||c.suit==='♦')?' red':'';
    return `<div class="card${red}"><div>${c.rank}</div><div style="align-self:center;font-size:1.2rem">${c.suit}</div><div style="align-self:flex-end;transform:rotate(180deg)">${c.rank}</div></div>`;
  }

  function render(){
    app.innerHTML = header()+lobby()+community()+players()+controls();
    const nbtn = document.getElementById('pkSave'); const ninp = document.getElementById('pkName'); if (nbtn) nbtn.onclick = ()=> sock.emit('profile:init', ninp.value.trim());
    const create = document.getElementById('create'); if (create) create.onclick = ()=> sock.emit('createRoom', (ninp&&ninp.value.trim())||'Player');
    const join = document.getElementById('join'); if (join) join.onclick = ()=> { const id = (document.getElementById('roomId').value||'').trim().toUpperCase(); if (id) sock.emit('joinRoom', { roomId:id, playerName:(ninp&&ninp.value.trim())||'Player'}); };
    const start = document.getElementById('start'); if (start) start.onclick = ()=> { if (currentRoom) sock.emit('startGame', currentRoom); };
    const fold = document.getElementById('fold'); if (fold) fold.onclick = ()=> sock.emit('playerAction', { roomId: currentRoom, action:'fold' });
    const check = document.getElementById('check'); if (check) check.onclick = ()=> sock.emit('playerAction', { roomId: currentRoom, action:'check' });
    const call = document.getElementById('call'); if (call) call.onclick = ()=> sock.emit('playerAction', { roomId: currentRoom, action:'call' });
    const raise = document.getElementById('raise'); if (raise) raise.onclick = ()=> { const v = parseInt(document.getElementById('raiseAmt').value)||0; sock.emit('playerAction', { roomId: currentRoom, action:'raise', amount:v }); };
    const pts = document.getElementById('pts'); if (pts && profile) pts.textContent = profile.points;
  }

  // sockets
  root.on('connect', ()=> { const saved = localStorage.getItem('casino:name')||''; root.emit('profile:init', saved); });
  root.on('profile', (p)=> { profile=p; render(); });
  root.on('leaderboard:update', ()=> { if (profile) { const el = document.getElementById('pts'); if (el) el.textContent = profile.points; } });

  sock.on('connect', ()=> { const saved = localStorage.getItem('casino:name')||''; sock.emit('profile:init', saved); });
  sock.on('profile', (p)=> { profile=p; render(); });
  sock.on('roomCreated', (data)=> { currentRoom = data.roomId; state = data.room; isHost=true; render(); });
  sock.on('playerJoined', (gs)=> { state = gs; if (!currentRoom) currentRoom = gs.roomId; render(); });
  sock.on('playerLeft', (gs)=> { state = gs; render(); });
  sock.on('gameStarted', (gs)=> { state=gs; render(); });
  sock.on('gameState', (gs)=> { state=gs; render(); });
  sock.on('joinFailed', (m)=> alert(m));

  render();
})();
