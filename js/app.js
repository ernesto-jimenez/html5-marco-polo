function Game(container) {
  var scope = this;
  scope.visible = true;
  scope.translateCoords = true;
  scope.playSound = true;
  scope.playing = false;
  scope.container = container;
  scope.direction = 0;
  scope.keys = {
    38: 'forward',
    41: 'backward',
    39: 'right',
    37: 'left'
  };
  scope.gameplay = new Gameplay();
  scope.sound = new SoundPlayer(new webkitAudioContext());

  this.testFront = function () {
    scope.gameplay.player.position.set(100, 200);
    scope.gameplay.player.direction = 90;
  };

  this.testBack = function () {
    scope.gameplay.player.position.set(100, 200);
    scope.gameplay.player.direction = 270;
  };

  this.start = function () {
    if (!scope.canvas) {
      scope.canvas = document.createElement('canvas');
      scope.container.appendChild(scope.canvas);

      window.addEventListener('resize', onWindowResize, false);
      scope.canvas.addEventListener('mouseUp', scope.changePlace, false);
      document.body.addEventListener('keydown', function (event) {
        if (scope.keys[event.which]) {
          scope.instruction[scope.keys[event.which]] = true;
          event.preventDefault();
        }
      });
      document.body.addEventListener('keyup', function (event) {
        if (scope.keys[event.which]) {
          scope.instruction[scope.keys[event.which]] = false;
          event.preventDefault();
        }
      });
    }

    scope.gameplay.start();

    onWindowResize();
    scope.playing = true;
    scope.instruction = {};
    scope.update();
  };

  function onWindowResize () {
    scope.width = window.innerWidth;
    scope.height = window.innerHeight;

    scope.canvas.width = scope.width;
    scope.canvas.height = scope.height;
    scope.center = new THREE.Vector3(scope.width / 2, scope.height / 2, 0);
    scope.context = scope.canvas.getContext('2d');
  }

  this.update = function () {
    if (!scope.playing) return;
    var time = new Date().getTime(),
    last = scope.lastUpdate || time,
    delta = (last - time) / 1000;
    window.requestAnimationFrame(scope.update);

    var instr = scope.instruction;

    if (instr.forward) { scope.gameplay.moveForward(delta); }
    if (instr.backward) { scope.gameplay.moveBackward(delta); }
    if (instr.right) { scope.gameplay.turnRight(delta); }
    if (instr.left) { scope.gameplay.turnLeft(delta); }

    scope.updateTranslation();
    if(scope.visible) { scope.draw(); }

    if(scope.playSound) {
      scope.sound.changePosition(scope.gameplay);
    } else {
      scope.sound.changePosition();
    }

    if (scope.gameplay.winsGame()) {
      alert('Victory!');
      scope.playing = false;
    }

    scope.lastUpdate = time;
  };

  function deg2rad(deg) {
    return deg * (Math.PI / 180);
  }

  this.updateTranslation = function () {
    scope.playing = true;
    scope.translation = scope.translation || new THREE.Vector3();
    scope.translation.subVectors(scope.center, scope.gameplay.player.position);
  };

  this.worldToCam = function (v) {
    return scope.translateCoords ? scope.translation.clone().add(v) : v;
  };

  this.drawHud = function (ctx) {
    var orig = scope.worldToCam(new THREE.Vector3(0, 0, 0)),
    axeX = scope.worldToCam(new THREE.Vector3(100, 0, 0)),
    axeY = scope.worldToCam(new THREE.Vector3(0, 100, 0));
    ctx.beginPath();
    ctx.strokeStyle = 'red';
    ctx.moveTo(orig.x, orig.y);
    ctx.lineTo(axeY.x, axeY.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.strokeStyle = 'blue';
    ctx.moveTo(orig.x, orig.y);
    ctx.lineTo(axeX.x, axeX.y);
    ctx.stroke();

    ctx.strokeStyle = 'brown';

    var gameplay = scope.gameplay,
        pos = scope.worldToCam(gameplay.player.position);

    ctx.beginPath();
    dir = scope.worldToCam(gameplay.facingVector().add(gameplay.player.position));

    ctx.fillStyle = "white";

    ctx.arc(pos.x, pos.y, 10, 0, Math.PI*2, false);
    ctx.stroke();
    ctx.fill();

    // Delta vector
    ctx.moveTo(pos.x, pos.y);
    ctx.lineTo(dir.x, dir.y);
    ctx.stroke();
  };

  this.drawObjective = function (ctx) {
    var gameplay = scope.gameplay,
        pos = scope.worldToCam(gameplay.objective.position);

    ctx.beginPath();

    ctx.strokeStyle = 'black';
    ctx.arc(pos.x, pos.y, 10, 0, Math.PI*2, false);
    ctx.stroke();

  };

  this.draw = function () {
    var ctx = scope.context;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, scope.width, scope.height);
    ctx.save();
    scope.drawHud(ctx);
    scope.drawObjective(ctx);
    ctx.restore();
  };
}

function SoundPlayer(context) {
    // http://freesound.org/people/Tewkesound/sounds/140147/
    var urls = ['position.wav'];
    var scope = this;
    this.isPlaying = false;
    var loader = new BufferLoader(context, urls, function (buffers) {
        scope.buffer = buffers[0];
    });
    loader.load();

    this.play = function () {
      var source = context.createBufferSource();
      if (!this.buffer) return false;
      source.buffer = this.buffer;
      source.loop = true;
      var panner = context.createPanner();
      //panner.coneOuterGain = 0.1;
      //panner.coneOuterAngle = 180;
      //panner.coneInnerAngle = 20;
      panner.rolloffFactor = 0.05;
      panner.connect(context.destination);
      source.connect(panner);
      source.noteOn(0);
      scope.source = source;
      scope.panner = panner;
      scope.isPlaying = true;
      return true;
    };

    this.stop = function () {
      if(scope.source) scope.source.noteOff(0);
      scope.isPlaying = false;
    };

    this.changePosition = function (gameplay) {
      if (gameplay) {
        if (!scope.isPlaying && !scope.play()) {
          return;
        }
        var player = gameplay.player.position,
            objective = gameplay.objective.position,
            orient = gameplay.facingVector().negate();

        context.listener.setOrientation(orient.x, orient.y, 0, 0, 0, 1);
        context.listener.setPosition(player.x, player.y, 0);
        scope.panner.setPosition(objective.x, objective.y, 0);
      } else {
        scope.stop();
      }
    };
}

function Gameplay() {
  var scope = this;
  var quaternion = new THREE.Quaternion();
  var rotationAxis = new THREE.Vector3(0,0,1);

  this.speed = 100;
  this.turnSpeed = 180;
  this.relativePos = new THREE.Vector3();

  this.player = {
    position: new THREE.Vector3(),
    direction: 270
  };

  this.objective = {
    position: new THREE.Vector3(),
    direction: 0
  };

  this.start = function () {
    this.player.position.set(200, 200, 0);
    this.player.direction = 90;
    this.objective.position.set(100, 100, 0);
    this.objective.direction = 0;
  };

  this.relativePosition = function () {
    return scope.relativePos.subVectors(scope.objective.position, scope.player.position);
  };

  this.facingVector = function () {
    return scope.deltaVector(1).setLength(-10);
  };

  this.soundVector = function () {
    quaternion.setFromAxisAngle(rotationAxis, (scope.player.direction + 90) * (Math.PI / 180));
    return scope.relativePosition().clone().applyQuaternion(quaternion);
  };

  this.turnRight = function (delta) {
    var player = scope.player;
    player.direction -= scope.turnSpeed * delta;
    player.direction = player.direction % 360;
  };

  this.turnLeft = function (delta) {
    var player = scope.player;
    player.direction += scope.turnSpeed * delta;
    player.direction = player.direction % 360;
  };

  this.deltaVector = function (delta) {
    var theta = scope.player.direction,
    distance = scope.speed * delta,
    deltaX = Math.cos(theta * (Math.PI / 180)) * distance,
    deltaY = Math.sin(theta * (Math.PI / 180)) * distance;

    //console.log({angle: theta, deltaX: deltaX, deltaY: deltaY});
    return new THREE.Vector3(deltaX, deltaY);
  };

  this.moveForward = function (delta) {
    scope.player.position.add(scope.deltaVector(delta));
  };

  this.moveBackward = function (delta) {
    scope.player.position.sub(scope.deltaVector(delta));
  };

  this.winsGame = function () {
    //console.log(scope.relativePosition().length());
    return scope.relativePosition().length() < 20;
  };
}

window.onload = function () {
  game = new Game(document.body);
  var gui = new dat.GUI();
  gui.add(game, 'start');
  gui.add(game, 'testFront');
  gui.add(game, 'testBack');
  gui.add(game, 'visible');
  gui.add(game, 'playSound');
  gui.add(game, 'translateCoords');
  game.start();
  var player = gui.addFolder('Player');
  player.add(game.gameplay.player, 'direction', 0, 360).listen();
  player.add(game.gameplay.player.position, 'y', -300, 300).listen();
  player.add(game.gameplay.player.position, 'x', -300, 300).listen();
  player.open();
  var objective = gui.addFolder('Objective');
  objective.add(game.gameplay.objective, 'direction', 0, 360);
  objective.add(game.gameplay.objective.position, 'y', -300, 300);
  objective.add(game.gameplay.objective.position, 'x', -300, 300);
  objective.open();
};

