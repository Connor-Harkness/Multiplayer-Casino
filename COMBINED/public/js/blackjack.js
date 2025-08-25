(function(){
  const sock = io('/blackjack');
  const root = io('/');
  const app = document.getElementById('app');
  let profile = null;
  let currentRoom = null;
  let gameState = null;

  function header(){
    return `
    <div class="section">
      <div class="flex" style="justify-content:space-between">
        <div>
          <input id="bjName" placeholder="Your name" maxlength="20" style="padding:.4rem;border-radius:6px;border:1px solid #4a5568;background:#1a202c;color:#fff"/>
          <button id="bjSave" class="btn">Save</button>
        </div>
        <div>Points: <span id="pointsHdr">${profile?profile.points:'-'}</span></div>
      </div>
    </div>`;
  }

  function lobbyView(){
    return `
    <div class="section">
      <div class="flex">
        <button id="create" class="btn">Create Room</button>
        <input id="roomId" placeholder="Room Code" maxlength="8" style="padding:.4rem;border-radius:6px;border:1px solid #4a5568;background:#1a202c;color:#fff"/>
        <button id="join" class="btn">Join</button>
      </div>
      <div class="status">${gameState?('Room: '+gameState.id):'No room'}</div>
      <div id="err" class="status" style="color:#e53e3e"></div>
    </div>`;
  }

  function dealerView(){
    if (!gameState) return '';
    const d = gameState.dealer;
    const showValue = (gameState.gameState==='finished'||gameState.gameState==='playing') ? (gameState.gameState==='finished' ? `Value: ${d.handValue}` : 'Value: ?') : '';
    const cards = d.hand.map((c,i)=> cardEl(c, gameState.gameState==='playing' && i===1)).join('');
    return `<div class="section"><div style="margin-bottom:.5rem;font-weight:600">Dealer</div><div style="margin-bottom:.5rem">${showValue}</div><div class="flex">${cards}</div></div>`;
  }

  function playersView(){
    if (!gameState) return '';
    const rows = gameState.players.map(p=>{
      const turn = (gameState.currentPlayerId===p.id && gameState.gameState==='playing') ? ' (turn)' : '';
      const hv = p.hasBusted ? `${p.handValue} (BUST)` : (p.hand?.length?`Value: ${p.handValue}`:'');
      const cards = (p.hand||[]).map(cardEl).join('');
      return `<div class="section"><div style="display:flex;justify-content:space-between"><div>${p.name}${p.isBot?' 🤖':''}${gameState.hostId===p.id?' 👑':''}${turn}</div><div>$${p.balance} | Bet: ${p.bet||0}</div></div><div class="flex">${cards}</div><div class="status">${hv}</div></div>`;
    }).join('');
    return `<div class="grid">${rows}</div>`;
  }

  function controls(){
    if (!gameState) return '';
    const me = gameState.players.find(p=>p.id===sock.id);
    let html = '<div class="section">';
    if (gameState.gameState==='lobby'){
      const isHost = gameState.hostId===sock.id;
      html += `<button id="start" class="btn" ${!isHost?'disabled':''}>Start Game</button>`;
    } else if (gameState.gameState==='betting'){
      if (me && !me.isBot && me.bet===0){
        const opts = [10,25,50,100].map(n=>`<button class="btn bet" data-a="${n}">$${n}</button>`).join('');
        html += `<div class="flex">${opts}<input id="customBet" type="number" min="1" max="${me.balance}" style="padding:.4rem;border-radius:6px;border:1px solid #4a5568;background:#1a202c;color:#fff;width:100px"/><button id="placeBet" class="btn">Place</button></div>`;
      } else {
        html += '<div class="status">Waiting for others to bet...</div>';
      }
    } else if (gameState.gameState==='playing'){
      if (me && !me.isBot && gameState.currentPlayerId===sock.id){
        html += `<button id="hit" class="btn">Hit</button><button id="stand" class="btn">Stand</button>`;
      } else {
        const cur = gameState.players.find(p=>p.id===gameState.currentPlayerId);
        html += `<div class="status">${cur?cur.name:"Dealer"}'s turn...</div>`;
      }
    } else if (gameState.gameState==='finished'){
      html += '<div class="status">Round finished. Returning to lobby...</div>';
    }
    html += '</div>';
    return html;
  }

  function cardEl(card, hidden=false){
    if (hidden) return `<div class="card hidden">?</div>`;
    const red = (card.suit==='♥'||card.suit==='♦')?' red':'';
    return `<div class="card${red}"><div>${card.rank}</div><div style="align-self:flex-end;transform:rotate(180deg)">${card.suit}</div></div>`;
  }

  function render(){
    app.innerHTML = header() + lobbyView() + dealerView() + playersView() + controls();
    const nameBtn = document.getElementById('bjSave');
    const nameInput = document.getElementById('bjName');
    if (nameBtn) nameBtn.onclick = ()=> sock.emit('profile:init', nameInput.value.trim());
    const create = document.getElementById('create'); if (create) create.onclick = ()=> sock.emit('createRoom', (nameInput&&nameInput.value.trim())||'Player');
    const join = document.getElementById('join'); if (join) join.onclick = ()=> { const id = (document.getElementById('roomId').value||'').trim(); if (id) sock.emit('joinRoom', { roomId:id, playerName:(nameInput&&nameInput.value.trim())||'Player' }); };
    const start = document.getElementById('start'); if (start) start.onclick = ()=> sock.emit('startGame');
    document.querySelectorAll('.bet').forEach(b=> b.addEventListener('click', ()=> sock.emit('placeBet', parseInt(b.dataset.a))));
    const place = document.getElementById('placeBet'); if (place) place.onclick = ()=> { const v = parseInt(document.getElementById('customBet').value); if (v>0) sock.emit('placeBet', v); };
    const hit = document.getElementById('hit'); if (hit) hit.onclick = ()=> sock.emit('hit');
    const stand = document.getElementById('stand'); if (stand) stand.onclick = ()=> sock.emit('stand');
    const pts = document.getElementById('pointsHdr'); if (pts && profile) pts.textContent = profile.points;
  }

  // sockets
  root.on('connect', ()=> { const saved = localStorage.getItem('casino:name')||''; root.emit('profile:init', saved); });
  root.on('profile', (p)=> { profile = p; render(); });
  root.on('leaderboard:update', ()=> { if (profile) { const el = document.getElementById('pointsHdr'); if (el) el.textContent = profile.points; } });

  sock.on('connect', ()=> { const saved = localStorage.getItem('casino:name')||''; sock.emit('profile:init', saved); });
  sock.on('profile', (p)=> { profile = p; render(); });
  sock.on('roomCreated', (data)=> { currentRoom = data.roomId; gameState = data.gameState; render(); });
  sock.on('gameStateUpdate', (gs)=> { gameState = gs; render(); });
  sock.on('error', (m)=> { const el = document.getElementById('err'); if (el) el.textContent = m; });

  render();
})();
