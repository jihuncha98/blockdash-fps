import * as THREE from 'three';

// BLOCKDASH PROTOTYPE 03 — 싱글플레이 3D 홀로그램 태그 아레나
// Multiplayer future: the game state, controls, and visuals are kept separately.
const $ = (selector) => document.querySelector(selector);
const canvas = $('#game');
const overlay = $('#screen');
const startButton = $('#play-button');
const message = $('#screen-message');
const hud = $('#hud');
const mobileControls = $('#mobile-controls');
const scoreLabel = $('#score');
const bestLabel = $('#best');
const timeLabel = $('#time');
const speedLabel = $('#speed');
const toast = $('#toast');
const joystickRing = $('#joy-ring');
const joystickKnob = $('#joy-knob');
const joyZone = $('#joy-zone');
const lookZone = $('#look-zone');
const tagButton = $('#tag-button');
const jumpButton = $('#jump-button');
const slideButton = $('#slide-button');
const coarsePointer = matchMedia('(pointer: coarse)').matches;
const ROUND_SECONDS = 90;
const HALF_ARENA = 35;
const PLAYER_RADIUS = 0.42;
const STANDING_EYE = 1.62;
const SLIDING_EYE = 1.02;
const PLAYER_HEIGHT = 1.85;
const GRAVITY = 23;
const JUMP_SPEED = 8.6;
const WALK_SPEED = 7;
const RUN_SPEED = 10.5;
const SLIDE_SPEED = 13.8;
const TAG_COOLDOWN = 0.20;
const random = (min, max) => min + Math.random() * (max - min);
const clamp = THREE.MathUtils.clamp;

const renderer = new THREE.WebGLRenderer({canvas, antialias: !coarsePointer, powerPreference: 'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, coarsePointer ? 1.35 : 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
renderer.shadowMap.enabled = !coarsePointer;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#94b8da');
scene.fog = new THREE.Fog('#94b8da', 48, 125);
const camera = new THREE.PerspectiveCamera(82, window.innerWidth / window.innerHeight, 0.05, 180);
camera.rotation.order = 'YXZ';
scene.add(new THREE.HemisphereLight('#deedff', '#405b69', 2.2));
const sunlight = new THREE.DirectionalLight('#ffebc8', 2.15);
sunlight.position.set(-21, 34, 17);
sunlight.castShadow = !coarsePointer;
sunlight.shadow.mapSize.set(1024, 1024);
sunlight.shadow.camera.left = -42;
sunlight.shadow.camera.right = 42;
sunlight.shadow.camera.top = 42;
sunlight.shadow.camera.bottom = -42;
sunlight.shadow.normalBias = 0.06;
scene.add(sunlight);

const materials = {
  floor: new THREE.MeshStandardMaterial({ color: '#8fb7aa', roughness: 0.98 }),
  tile: new THREE.MeshStandardMaterial({ color: '#a7d1c2', roughness: 0.95 }),
  wall: new THREE.MeshStandardMaterial({ color: '#355573', roughness: 0.88 }),
  wallAlt: new THREE.MeshStandardMaterial({ color: '#456985', roughness: 0.88 }),
  top: new THREE.MeshStandardMaterial({ color: '#628faa', roughness: 0.85 }),
  crate: new THREE.MeshStandardMaterial({ color: '#f5ae62', roughness: 0.9 }),
  crateTop: new THREE.MeshStandardMaterial({ color: '#ffd292', roughness: 0.95 }),
  dark: new THREE.MeshStandardMaterial({ color: '#1e354b', roughness: 0.8 }),
  white: new THREE.MeshStandardMaterial({ color: '#f2f8ff', roughness: 0.9 }),
};
const colliders = [];
const lineOfSightObjects = [];
function makeBlock(x, y, z, w, h, d, material, {solid = true, sight = true, shadow = true} = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  scene.add(mesh);
  if (solid) colliders.push({ minX:x-w/2, maxX:x+w/2, minZ:z-d/2, maxZ:z+d/2, minY:y-h/2, maxY:y+h/2 });
  if (sight) lineOfSightObjects.push(mesh);
  return mesh;
}

function addArena() {
  makeBlock(0, -0.6, 0, 74, 1.2, 74, materials.floor, {solid: false, sight: false, shadow: false});
  // Grid marks on the ground, merged visually through inexpensive flat meshes.
  const grid = new THREE.GridHelper(70, 35, '#a5d5c6', '#a5d5c6');
  grid.position.y = 0.012;
  grid.material.transparent = true;
  grid.material.opacity = 0.33;
  scene.add(grid);
  // Map boundary walls: the player can see their position and never leave the map.
  makeBlock(0, 3, -35.8, 73, 6, 2, materials.wall);
  makeBlock(0, 3, 35.8, 73, 6, 2, materials.wall);
  makeBlock(-35.8, 3, 0, 2, 6, 73, materials.wall);
  makeBlock(35.8, 3, 0, 2, 6, 73, materials.wall);
  // A symmetric low-poly arena with distinct height/colour landmarks.
  const blocks = [
    [-20,-17, 9,4,5], [-20,10, 7,5,8], [19,-16, 8,5,8], [20,13, 9,4,5],
    [-10,-3, 5,4,12], [10,3, 5,4,12], [0,0, 6,6,6],
    [-27,0, 4,3,9], [27,0, 4,3,9], [0,-26, 13,4,3], [0,25, 13,4,3],
    [-10,17, 7,3,4], [11,-18, 7,3,4], [-13,-22, 5,4,5], [13,21, 5,4,5],
  ];
  for (const [x,z,w,h,d] of blocks) {
    makeBlock(x, h/2, z, w,h,d, Math.abs(x+z)%3 < 1 ? materials.wallAlt : materials.wall);
    makeBlock(x, h+0.15, z, w+0.35,0.3,d+0.35, materials.top, {solid:false,sight:true});
  }
  const crates = [
    [-25,-25], [-25,-22], [24,-25], [24,-22], [-26,23], [25,25],
    [-13,6], [13,-7], [-5,12], [6,-12], [-20,-2], [22,2],
  ];
  for (const [x,z] of crates) {
    const height = 2.4;
    makeBlock(x,height/2,z,2.7,height,2.7,materials.crate);
    makeBlock(x,height+0.045,z,2.8,0.09,2.8,materials.crateTop,{solid:false,sight:false});
  }
  // Accent columns and floating signs add detail without downloaded assets.
  for (const [x,z] of [[-30,-30],[30,-30],[-30,30],[30,30]]) {
    makeBlock(x,4.6,z,1.6,9.2,1.6,materials.dark);
    makeBlock(x,9.4,z,2.2,0.5,2.2,materials.crateTop,{solid:false,sight:false});
  }
  for(const [x,z] of [[-30,0],[30,0],[0,-30],[0,30]]) {
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.3,1.3,0.1,8),materials.white);
    pad.position.set(x,0.06,z); scene.add(pad);
  }
}
addArena();

const player = {
  position: new THREE.Vector3(0, 0, 19),
  velocity: new THREE.Vector3(),
  yaw: 0, pitch: -0.025, eyeHeight: STANDING_EYE,
  grounded: true, sliding: 0,
};
const keys = new Set();
const touch = { moveX: 0, moveY: 0, joyId: null, lookId: null, lastLookX: 0, lastLookY: 0, jump: false, slide: false, tag: false };
// Each finger has an independent identifier so moving, tagging and looking can happen at once.
const tagLook = { id: null, lastX: 0, lastY: 0 };
function resetTouchInput() {
  touch.moveX = 0;
  touch.moveY = 0;
  touch.joyId = null;
  touch.lookId = null;
  touch.jump = false;
  touch.slide = false;
  touch.tag = false;
  tagLook.id = null;
  joystickKnob.style.transform = 'translate(0px,0px)';
}

let active = false;
let ended = false;
let paused = false;
let secondsLeft = ROUND_SECONDS;
let score = 0;
let best = 0;
let lastTagTime = -Infinity;
let elapsed = 0;
let toastDeadline = 0;
let lastFrame = performance.now();
let mouseDragging = false;
let fireHeld = false;
try { best = Number(localStorage.getItem('blockdash_best') || 0) || 0; } catch { /* storage may be blocked */ }
bestLabel.textContent = String(best);

function syncView() {
  camera.position.copy(player.position);
  camera.position.y += player.eyeHeight;
  camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
}

// A glowing abstract 'target' is a game object, not a realistic weapon target.
const targets = [];
const targetCoreGeo = new THREE.IcosahedronGeometry(0.85, 0);
const targetRingGeo = new THREE.TorusGeometry(1.22, 0.09, 7, 24);
const targetColours = ['#49e8ef','#f4d76d','#f47ab8','#a998ff','#8ff1ac'];
const usedTargetPositions = [];
function canSpawn(x,z) {
  if (Math.hypot(x-player.position.x,z-player.position.z)<8) return false;
  if (Math.abs(x)>30 || Math.abs(z)>30) return false;
  if (usedTargetPositions.some(p=>Math.hypot(p.x-x,p.z-z)<5)) return false;
  return !colliders.some(c=>x>c.minX-2 && x<c.maxX+2 && z>c.minZ-2 && z<c.maxZ+2);
}
function moveTarget(target) {
  // Place at visible game height, outside obstacles and not stacked together.
  usedTargetPositions.length = 0;
  for (const other of targets) if(other!==target && other.group.visible) usedTargetPositions.push(other.group.position);
  for(let attempts=0; attempts<220; attempts++) {
    const x=random(-29,29), z=random(-29,29);
    if(canSpawn(x,z)) { target.group.position.set(x, random(2.3,3.8), z); target.group.visible = true; return; }
  }
  target.group.position.set(0,3,-27); target.group.visible = true;
}
function makeTarget(index) {
  const colour = targetColours[index % targetColours.length];
  const group = new THREE.Group();
  const core = new THREE.Mesh(targetCoreGeo, new THREE.MeshStandardMaterial({color:colour, emissive:colour, emissiveIntensity:1.3, roughness:0.3, metalness:0.15}));
  const ring = new THREE.Mesh(targetRingGeo, new THREE.MeshBasicMaterial({color:colour, transparent:true, opacity:0.85}));
  ring.rotation.x = Math.PI/3;
  const ring2 = ring.clone(); ring2.rotation.x = Math.PI/2.5; ring2.rotation.y = 1.2;
  const point = new THREE.PointLight(colour, 1.5, 6);
  group.add(core,ring,ring2,point);
  scene.add(group);
  const target = { group, core, ring, ring2, baseY:0, phase:index*1.7 };
  core.userData.target = target;
  targets.push(target);
  moveTarget(target);
  target.baseY = group.position.y;
}
for(let i=0;i<5;i++) makeTarget(i);

const raycaster = new THREE.Raycaster();
raycaster.far = 85;
const pulseGeo = new THREE.SphereGeometry(0.10, 8, 6);
const pulseMaterial = new THREE.MeshBasicMaterial({color:'#e8ffff',transparent:true,opacity:0.95});
const pulseFX = [];
function spawnPulse(point) {
  const pulse = new THREE.Mesh(pulseGeo, pulseMaterial.clone());
  pulse.position.copy(point);
  pulse.scale.setScalar(0.2);
  scene.add(pulse);
  pulseFX.push({mesh:pulse, life:0.32});
}
function announce(text) {
  toast.textContent = text;
  toast.classList.add('visible');
  toastDeadline = elapsed + 1.1;
}
function tag() {
  if (!active || ended || elapsed-lastTagTime < TAG_COOLDOWN) return;
  lastTagTime = elapsed;
  syncView();
  camera.updateMatrixWorld();
  const direction = new THREE.Vector3(); camera.getWorldDirection(direction);
  raycaster.set(camera.position, direction);
  const candidates = [...lineOfSightObjects,...targets.map(t=>t.core)];
  const intersections = raycaster.intersectObjects(candidates, false);
  const first = intersections[0];
  if(first) {
    spawnPulse(first.point);
    const target = first.object.userData.target;
    if(target) {
      score += 10;
      scoreLabel.textContent=String(score);
      announce('+10  PERFECT TAG');
      target.group.visible = false;
      moveTarget(target);
      target.baseY = target.group.position.y;
    }
  } else {
    spawnPulse(camera.position.clone().addScaledVector(direction,35));
  }
  document.querySelector('.reticle').classList.remove('flash');
  void document.querySelector('.reticle').offsetWidth;
  document.querySelector('.reticle').classList.add('flash');
}

function circleOverlapsBox(x,z,c, radius=PLAYER_RADIUS) {
  const closestX=clamp(x,c.minX,c.maxX);
  const closestZ=clamp(z,c.minZ,c.maxZ);
  return (x-closestX)**2+(z-closestZ)**2<radius**2;
}
function blockedAt(x,z) {
  return colliders.some(c=>circleOverlapsBox(x,z,c));
}
function moveWithCollision(dx,dz) {
  const x=clamp(player.position.x+dx,-HALF_ARENA+1,HALF_ARENA-1);
  if(!blockedAt(x,player.position.z)) player.position.x=x;
  else player.velocity.x=0;
  const z=clamp(player.position.z+dz,-HALF_ARENA+1,HALF_ARENA-1);
  if(!blockedAt(player.position.x,z)) player.position.z=z;
  else player.velocity.z=0;
}

// Reusable camera-relative ground vectors to avoid creating objects every frame.
const movementForward = new THREE.Vector3();
const movementRight = new THREE.Vector3();
function updateMovement(dt) {
  const forward = (keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-touch.moveY;
  const strafe = (keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+touch.moveX;
  const length = Math.hypot(forward,strafe);
  const f=length ? forward/Math.max(1,length) : 0;
  const s=length ? strafe/Math.max(1,length) : 0;
  // Read the camera's actual world-space forward direction.
  // Discard vertical pitch so W/S move on the ground plane.
  syncView();
  camera.getWorldDirection(movementForward);
  movementForward.y = 0;
  movementForward.normalize();
  // The camera's horizontal right vector is perpendicular to forward.
  movementRight.set(-movementForward.z, 0, movementForward.x);
  const directionX = movementForward.x*f + movementRight.x*s;
  const directionZ = movementForward.z*f + movementRight.z*s;
  const running=keys.has('ShiftLeft')||keys.has('ShiftRight')||(coarsePointer&&length>0.7);
  const wantsSlide=keys.has('KeyC')||keys.has('ControlLeft')||keys.has('ControlRight')||touch.slide;
  const horizontalSpeed=Math.hypot(player.velocity.x,player.velocity.z);
  if (wantsSlide && player.sliding <= 0 && player.grounded && length>0.2) {
    player.sliding=0.80;
    player.velocity.x=directionX*Math.max(horizontalSpeed,SLIDE_SPEED);
    player.velocity.z=directionZ*Math.max(horizontalSpeed,SLIDE_SPEED);
    touch.slide=false;
  }
  if(player.sliding>0) {
    player.sliding=Math.max(0,player.sliding-dt);
    player.velocity.x*=Math.exp(-dt*0.9);
    player.velocity.z*=Math.exp(-dt*0.9);
  } else {
    const wantedSpeed=running?RUN_SPEED:WALK_SPEED;
    const acceleration=player.grounded?Math.min(1,dt*13):Math.min(1,dt*3.5);
    player.velocity.x=THREE.MathUtils.lerp(player.velocity.x,directionX*wantedSpeed,acceleration);
    player.velocity.z=THREE.MathUtils.lerp(player.velocity.z,directionZ*wantedSpeed,acceleration);
  }
  const jump=keys.has('Space')||touch.jump;
  if(jump && player.grounded) {
    player.velocity.y=JUMP_SPEED;
    player.grounded=false;
    player.sliding=0;
  }
  touch.jump=false;
  player.velocity.y-=GRAVITY*dt;
  player.position.y+=player.velocity.y*dt;
  if(player.position.y<=0) {
    player.position.y=0;
    player.velocity.y=0;
    player.grounded=true;
  }
  moveWithCollision(player.velocity.x*dt,player.velocity.z*dt);
  const targetEye=player.sliding>0?SLIDING_EYE:STANDING_EYE;
  player.eyeHeight=THREE.MathUtils.lerp(player.eyeHeight,targetEye,Math.min(1,dt*12));
  speedLabel.textContent=Math.hypot(player.velocity.x,player.velocity.z).toFixed(1);
  if((touch.tag||fireHeld) && active) tag();
}

function setLook(dx,dy,sensitivity=0.0024) {
  player.yaw -= dx*sensitivity;
  player.pitch=clamp(player.pitch-dy*sensitivity,-Math.PI/2+0.12,Math.PI/2-0.12);
}
function resetGame() {
  resetTouchInput();
  player.position.set(0,0,19);
  player.velocity.set(0,0,0);
  player.yaw=0;
  player.pitch=-0.025;
  player.eyeHeight=STANDING_EYE;
  player.grounded=true;
  player.sliding=0;
  elapsed=0;
  secondsLeft=ROUND_SECONDS;
  score=0;
  lastTagTime=-Infinity;
  ended=false;
  paused=false;
  scoreLabel.textContent='0';
  timeLabel.textContent=String(ROUND_SECONDS);
  toast.textContent='';
  for(const t of targets) { moveTarget(t);t.baseY=t.group.position.y; }
}
function enterGame() {
  if(!paused || ended) resetGame();
  paused=false;
  active=true;
  hud.hidden=false;
  overlay.hidden=true;
  message.textContent='';
  startButton.textContent='계속 플레이';
  if(coarsePointer) mobileControls.hidden=false;
  else if(document.pointerLockElement!==canvas) {
    // Only a user gesture can request pointer lock; drag-look is fallback.
    try { canvas.requestPointerLock?.(); } catch { /* fallback to mouse drag */ }
  }
}
function pauseGame() {
  if(!active) return;
  paused=true;
  active=false;
  fireHeld=false;
  resetTouchInput();
  keys.clear();
  mobileControls.hidden=true;
  overlay.hidden=false;
  startButton.textContent='계속 플레이';
  message.textContent='일시정지 · 계속 플레이를 누르면 현재 라운드로 돌아갑니다.';
}
function finishGame() {
  active=false;
  paused=false;
  ended=true;
  fireHeld=false;
  resetTouchInput();
  mobileControls.hidden=true;
  overlay.hidden=false;
  if(score>best) {
    best=score;
    bestLabel.textContent=String(best);
    try {localStorage.setItem('blockdash_best',String(best));}catch { /* storage may be blocked */ }
  }
  startButton.textContent='다시 도전';
  message.textContent=`라운드 종료! ${score}점 · 최고 기록 ${best}점`;
  if(document.pointerLockElement===canvas) document.exitPointerLock?.();
}

startButton.addEventListener('click',enterGame);
window.addEventListener('keydown',(event)=>{
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code)) event.preventDefault();
  if(event.code==='Escape' && active) pauseGame();
  keys.add(event.code);
  if(event.code==='KeyR' && !active) enterGame();
});
window.addEventListener('keyup',(event)=>{keys.delete(event.code);});
window.addEventListener('blur',()=>{ if(active) pauseGame(); });
window.addEventListener('mousemove',(event)=>{
  if(!active||coarsePointer) return;
  if(document.pointerLockElement===canvas || mouseDragging) setLook(event.movementX,event.movementY);
});
canvas.addEventListener('pointerdown',(event)=>{
  if(!active||coarsePointer) return;
  if(document.pointerLockElement!==canvas) {
    mouseDragging=true;
    canvas.requestPointerLock?.();
  }
  if(event.button===0) {fireHeld=true;tag();}
});
window.addEventListener('pointerup',()=>{mouseDragging=false;fireHeld=false;});
document.addEventListener('pointerlockchange',()=>{
  // ESC exits pointer-lock; pause until player actively resumes.
  if(!coarsePointer && document.pointerLockElement!==canvas && active) pauseGame();
});
window.addEventListener('contextmenu',(event)=>event.preventDefault());

// iPadOS: use Touch Events with unique finger identifiers. Unlike a single
// pointer capture, independent fingers can steer, look and hold TAG together.
// Pointer Events remain as a fallback on touch-capable non-iPad devices.
function joystickVector(point) {
  const rect = joystickRing.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const max = rect.width * 0.30;
  let x = (point.clientX - centerX) / max;
  let y = (point.clientY - centerY) / max;
  const length = Math.hypot(x, y);
  if (length > 1) { x /= length; y /= length; }
  touch.moveX = x;
  touch.moveY = y;
  joystickKnob.style.transform = `translate(${x*max}px,${y*max}px)`;
}
function releaseJoy() {
  touch.joyId = null;
  touch.moveX = 0;
  touch.moveY = 0;
  joystickKnob.style.transform = 'translate(0px,0px)';
}
function beginLook(point) {
  if (!active || touch.lookId !== null) return;
  touch.lookId = point.identifier ?? point.pointerId;
  touch.lastLookX = point.clientX;
  touch.lastLookY = point.clientY;
}
function moveLook(point) {
  const id = point.identifier ?? point.pointerId;
  if (!active || id !== touch.lookId) return;
  setLook(point.clientX - touch.lastLookX, point.clientY - touch.lastLookY, 0.0043);
  touch.lastLookX = point.clientX;
  touch.lastLookY = point.clientY;
}
function beginTag(point) {
  if (!active || tagLook.id !== null) return;
  tagLook.id = point.identifier ?? point.pointerId;
  tagLook.lastX = point.clientX;
  tagLook.lastY = point.clientY;
  touch.tag = true;
  tag();
}
function moveTag(point) {
  // TAG is also an aim surface. Dragging the held TAG finger turns the camera.
  const id = point.identifier ?? point.pointerId;
  if (!active || id !== tagLook.id) return;
  setLook(point.clientX - tagLook.lastX, point.clientY - tagLook.lastY, 0.0043);
  tagLook.lastX = point.clientX;
  tagLook.lastY = point.clientY;
}
function releaseTag(id) {
  if (id !== tagLook.id) return;
  tagLook.id = null;
  touch.tag = false;
}
// Also accept aim gestures along the upper part of the right side of the screen.
lookZone.style.height = '100%';
const useNativeTouch = coarsePointer && ('ontouchstart' in window);
if (useNativeTouch) {
  // Touch events keep a finger bound to its initial element even when it moves
  // away from that element. This makes press-and-drag TAG work on Safari.
  function onTouches(element, eventName, handle) {
    element.addEventListener(eventName, event => {
      if (!active) return;
      event.preventDefault();
      for (let i = 0; i < event.changedTouches.length; i++) handle(event.changedTouches[i]);
    }, { passive: false });
  }
  onTouches(joyZone, 'touchstart', point => {
    if (touch.joyId !== null) return;
    touch.joyId = point.identifier;
    joystickVector(point);
  });
  onTouches(joyZone, 'touchmove', point => {
    if (point.identifier === touch.joyId) joystickVector(point);
  });
  for (const type of ['touchend', 'touchcancel']) {
    onTouches(joyZone, type, point => {
      if (point.identifier === touch.joyId) releaseJoy();
    });
  }
  onTouches(lookZone, 'touchstart', beginLook);
  onTouches(lookZone, 'touchmove', moveLook);
  for (const type of ['touchend', 'touchcancel']) {
    onTouches(lookZone, type, point => {
      if (point.identifier === touch.lookId) touch.lookId = null;
    });
  }
  onTouches(tagButton, 'touchstart', beginTag);
  onTouches(tagButton, 'touchmove', moveTag);
  for (const type of ['touchend', 'touchcancel']) {
    onTouches(tagButton, type, point => releaseTag(point.identifier));
  }
  onTouches(jumpButton, 'touchstart', () => { touch.jump = true; });
  onTouches(slideButton, 'touchstart', () => { touch.slide = true; });
} else {
  // Pointer fallback for touchscreen browsers without Touch Events.
  joyZone.addEventListener('pointerdown', event => {
    if (!active || touch.joyId !== null) return;
    event.preventDefault();
    touch.joyId = event.pointerId;
    joyZone.setPointerCapture(event.pointerId);
    joystickVector(event);
  });
  joyZone.addEventListener('pointermove', event => {
    if (event.pointerId === touch.joyId) joystickVector(event);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    joyZone.addEventListener(type, event => {
      if (event.pointerId === touch.joyId) releaseJoy();
    });
  }
  lookZone.addEventListener('pointerdown', event => {
    if (!active || touch.lookId !== null) return;
    event.preventDefault();
    beginLook(event);
    lookZone.setPointerCapture(event.pointerId);
  });
  lookZone.addEventListener('pointermove', moveLook);
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    lookZone.addEventListener(type, event => {
      if (event.pointerId === touch.lookId) touch.lookId = null;
    });
  }
  tagButton.addEventListener('pointerdown', event => {
    if (!active || tagLook.id !== null) return;
    event.preventDefault();
    beginTag(event);
    tagButton.setPointerCapture(event.pointerId);
  });
  tagButton.addEventListener('pointermove', moveTag);
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    tagButton.addEventListener(type, event => releaseTag(event.pointerId));
  }
  for (const [button, name] of [[jumpButton, 'jump'], [slideButton, 'slide']]) {
    button.addEventListener('pointerdown', event => {
      if (!active) return;
      event.preventDefault();
      touch[name] = true;
    });
  }
}

function animate(now) {
  requestAnimationFrame(animate);
  const dt=Math.min((now-lastFrame)/1000,0.034);
  lastFrame=now;
  if(active) {
    elapsed+=dt;
    secondsLeft=Math.max(0,ROUND_SECONDS-elapsed);
    timeLabel.textContent=String(Math.ceil(secondsLeft));
    updateMovement(dt);
    if(secondsLeft<=0) finishGame();
    if(elapsed>toastDeadline) toast.classList.remove('visible');
  }
  for(const target of targets) {
    const time=now/1000;
    target.group.position.y=target.baseY+Math.sin(time*1.8+target.phase)*0.24;
    target.core.rotation.y+=dt*0.8;
    target.ring.rotation.z+=dt*0.7;
    target.ring2.rotation.z-=dt*0.55;
  }
  for(let i=pulseFX.length-1;i>=0;i--) {
    const fx=pulseFX[i];
    fx.life-=dt;
    fx.mesh.scale.setScalar(Math.max(0.01,1-fx.life/0.32)*4);
    fx.mesh.material.opacity=Math.max(0,fx.life/0.32);
    if(fx.life<=0) {scene.remove(fx.mesh);fx.mesh.material.dispose();pulseFX.splice(i,1);}
  }
  syncView();
  renderer.render(scene,camera);
}
window.addEventListener('resize',()=>{
  const width=window.innerWidth,height=window.innerHeight;
  camera.aspect=width/height;
  camera.updateProjectionMatrix();
  renderer.setSize(width,height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, coarsePointer ? 1.35 : 1.75));
});
syncView();
requestAnimationFrame(animate);
