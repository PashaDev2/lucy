import "./style.css";
import * as THREE from "three";
import { GUI } from "three/addons/libs/lil-gui.module.min.js";
import { PLYLoader } from "three/addons/loaders/PLYLoader.js";
import useLucy from "./useLucy";
import CustomShaderMaterial from "three-custom-shader-material/vanilla";

let renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  spotLight: THREE.SpotLight,
  lucyMesh: THREE.Mesh,
  lucyMaterial: THREE.MeshPhysicalMaterial,
  bgMaterial: THREE.ShaderMaterial,
  bgMesh: THREE.Mesh;

document.addEventListener("DOMContentLoaded", init);

function init() {
  const appElement = document.getElementById("app") as HTMLElement;

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setAnimationLoop(animate);
  renderer.domElement.classList.add("canvas");
  appElement.appendChild(renderer.domElement);

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(
    40,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.set(-0.5, 2.5, 2);

  // const controls = new OrbitControls(camera, renderer.domElement);
  // controls.enableDamping = true;

  const ambient = new THREE.HemisphereLight(0xffffff, 0x8d8d8d, 0.15);
  scene.add(ambient);

  const loader = new THREE.TextureLoader().setPath("/textures/");
  const filenames = [
    "disturb.jpg",
    "colors.png",
    "uv_grid_opengl.jpg",
    "material_244.webp",
    "material_297.webp",
  ];

  const textures = { none: null } as Record<string, THREE.Texture | null>;

  for (let i = 0; i < filenames.length; i++) {
    const filename = filenames[i];

    const texture = loader.load(filename);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.colorSpace = THREE.SRGBColorSpace;

    textures[filename] = texture;
  }

  spotLight = new THREE.SpotLight(new THREE.Color("#6495ed"));
  spotLight.color = new THREE.Color(0x031a6b);
  spotLight.angle = Math.PI;
  spotLight.penumbra = 1;
  spotLight.decay = 2;
  spotLight.distance = 1;
  spotLight.map = null;
  spotLight.intensity = 5;
  spotLight.castShadow = true;
  spotLight.shadow.mapSize.width = 1024;
  spotLight.shadow.mapSize.height = 1024;
  spotLight.shadow.camera.near = 1;
  spotLight.shadow.camera.far = 10;
  spotLight.shadow.focus = 1;
  scene.add(spotLight);

  bgMaterial = new THREE.ShaderMaterial({
    fragmentShader: `

      uniform vec3      iResolution;           // viewport resolution (in pixels)
      uniform float     iTime;                 // shader playback time (in seconds)
      uniform vec2      iMouse;                // mouse pixel coords. xy: current (if MLB down), zw: click
      
      uniform float uTotal;//number of rectangles
      uniform float uMinSize;//rectangle min size
      uniform float uMaxSize;//rectangle max size
      uniform float uYDistribution;

      uniform float uNoiseIntensity;
      uniform float uNoiseDefinition;
      uniform vec2 uGlowPos;

      uniform vec3 bgColor;
      uniform vec3 rectColor;

      varying vec2 vUv;

      float random(vec2 co){
          return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
      }

      float noise( in vec2 p )
      {
          p*=uNoiseIntensity;
          vec2 i = floor( p );
          vec2 f = fract( p );
        vec2 u = f*f*(3.0-2.0*f);
          return mix( mix( random( i + vec2(0.0,0.0) ), 
                          random( i + vec2(1.0,0.0) ), u.x),
                      mix( random( i + vec2(0.0,1.0) ), 
                          random( i + vec2(1.0,1.0) ), u.x), u.y);
      }

      float fbm( in vec2 uv )
      {	
        uv *= 5.0;
          mat2 m = mat2( 1.6,  1.2, -1.2,  1.6 );
          float f  = 0.5000*noise( uv ); uv = m*uv;
          f += 0.2500*noise( uv ); uv = m*uv;
          f += 0.1250*noise( uv ); uv = m*uv;
          f += 0.0625*noise( uv ); uv = m*uv;
          
        f = 0.5 + 0.5*f;
          return f;
      }

      vec3 bg(vec2 uv )
      {
          float velocity = iTime/1.6;
          float intensity = sin(uv.x*3.+velocity*2.)*1.1+1.5;
          uv.y -= 2.;
          vec2 bp = uv+uGlowPos;
          uv *= uNoiseDefinition;

          //ripple
          float rb = fbm(vec2(uv.x*.5-velocity*.03, uv.y))*.1;
          //rb = sqrt(rb); 
          uv += rb;models

          //coloring
          float rz = fbm(uv*.9+vec2(velocity*.35, 0.0));
          rz *= dot(bp*intensity,bp)+1.2;

          //bazooca line
          //rz *= sin(uv.x*.5+velocity*.8);


          vec3 col = bgColor/(.1-rz);
          return sqrt(abs(col));
      }


      float rectangle(vec2 uv, vec2 pos, float width, float height, float blur) {
          
          pos = (vec2(width, height) + .01)/2. - abs(uv - pos);
          pos = smoothstep(0., blur , pos);
          return pos.x * pos.y; 
        
      }

      mat2 rotate2d(float _angle){
          return mat2(cos(_angle),-sin(_angle),
                      sin(_angle),cos(_angle));
      }

      void mainImage( out vec4 fragColor, in vec2 fragCoord )
      {
        vec2 uv = fragCoord.xy / iResolution.xy * 2. - 1.;
          uv.x *= iResolution.x/iResolution.y;
          
          //bg
          vec3 color = bg(uv)*(2.-abs(uv.y*2.));
          
          //rectangles
          float velX = -iTime/8.;
          float velY = iTime/10.;
          for(float i=0.; i<uTotal; i++){
              float index = i/uTotal;
              float rnd = random(vec2(index));
              vec3 pos = vec3(0, 0., 0.);
              pos.x = fract(velX*rnd+index)*4.-2.0;
              pos.y = sin(index*rnd*1000.+velY) * uYDistribution;
              pos.z = uMaxSize*rnd+uMinSize;
              vec2 uvRot = uv - pos.xy + pos.z/2.;
            uvRot = rotate2d( i+iTime/2. ) * uvRot;
              uvRot += pos.xy+pos.z/2.;
              float rect = rectangle(uvRot, pos.xy, pos.z, pos.z, (uMaxSize+uMinSize-pos.z)/2.);
            color += rectColor * rect * pos.z/uMaxSize;
          }
          
        fragColor = vec4(color, 1.0);
      }
      void main() {
        mainImage(gl_FragColor, vUv * iResolution.xy);
      }
    `,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    uniforms: {
      iResolution: {
        value: new THREE.Vector3(window.innerWidth, window.innerHeight, 1),
      },
      iTime: { value: 0 },
      iMouse: { value: new THREE.Vector2() },

      uTotal: { value: 60 },
      uMinSize: { value: 0.03 },
      uMaxSize: { value: 0.08 },
      uYDistribution: { value: 0.5 },
      uNoiseIntensity: { value: 2.8 },
      uNoiseDefinition: { value: 0.6 },
      uGlowPos: { value: new THREE.Vector2(-2, 0) },
      bgColor: { value: new THREE.Color(0.01, 0.16, 0.42) },
      rectColor: { value: new THREE.Color(0.01, 0.26, 0.57) },
    },
    side: THREE.DoubleSide,
    // z index
    depthTest: false,
    depthWrite: false,
  });
  const aspect = window.innerWidth / window.innerHeight;
  const bgGeometry = new THREE.PlaneGeometry(15 * aspect, 15);
  bgMesh = new THREE.Mesh(bgGeometry, bgMaterial);
  scene.add(bgMesh);
  bgMesh.position.z = -15;
  bgMesh.position.y = 2.5;

  // GUI

  const gui = new GUI();
  lucyMaterial;
  lucyMaterial;

  let params: Record<string, any> = {
    color: spotLight.color.getHex(),
    intensity: spotLight.intensity,
    distance: spotLight.distance,
    angle: spotLight.angle,
    penumbra: spotLight.penumbra,
    decay: spotLight.decay,
    focus: spotLight.shadow.focus,
    shadows: true,

    total: bgMaterial.uniforms.uTotal.value,
    minSize: bgMaterial.uniforms.uMinSize.value,
    maxSize: bgMaterial.uniforms.uMaxSize.value,
    yDistribution: bgMaterial.uniforms.uYDistribution.value,
    noiseIntensity: bgMaterial.uniforms.uNoiseIntensity.value,
    noiseDefinition: bgMaterial.uniforms.uNoiseDefinition.value,
    glowPos: bgMaterial.uniforms.uGlowPos.value,
    bgColor: bgMaterial.uniforms.bgColor.value,
    rectColor: bgMaterial.uniforms.rectColor.value,
  };

  new PLYLoader().load("/models/ply/binary/Lucy100k.ply", function (geometry) {
    geometry.scale(0.0024, 0.0024, 0.0024);
    geometry.computeVertexNormals();

    lucyMaterial = new CustomShaderMaterial({
      baseMaterial: THREE.MeshPhysicalMaterial,
      uniforms: {
        time: { value: 0 },
      },
      envMap: textures["disturb.jpg"],
      envMapIntensity: 1,
      ior: 1.2,
      transmission: 0.141,
      reflectivity: 0.5,
      roughness: 0.8,
      metalness: 0.1,
      vertexShader: `
        void main() {
          csm_Position = position;
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform sampler2D sampler;

        void main() {
        }
      `,
      silent: true,
      depthTest: true,
      depthWrite: true,
    }) as unknown as THREE.MeshPhysicalMaterial;

    lucyMesh = new THREE.Mesh(geometry, lucyMaterial);
    lucyMesh.castShadow = true;
    lucyMesh.receiveShadow = true;
    scene.add(lucyMesh);

    params = {
      ...params,
      // mesh physical material
      ior: lucyMaterial.ior,
      transmission: lucyMaterial.transmission,
      roughness: lucyMaterial.roughness,
      metalness: lucyMaterial.metalness,
      envMapIntensity: lucyMaterial.envMapIntensity,
    };
    // gui for lucy
    const lucyFolder = gui.addFolder("Lucy Material");
    lucyFolder.add(params, "ior", 0, 2).onChange(function (val) {
      lucyMaterial.ior = val;
    });
    lucyFolder.add(params, "transmission", 0, 1).onChange(function (val) {
      lucyMaterial.transmission = val;
    });
    lucyFolder.add(params, "roughness", 0, 1).onChange(function (val) {
      lucyMaterial.roughness = val;
    });
    lucyFolder.add(params, "metalness", 0, 1).onChange(function (val) {
      lucyMaterial.metalness = val;
    });
  });

  window.addEventListener("resize", onWindowResize);
  window.addEventListener("mousemove", onMouseMove);

  //  gui for spot light
  const lightFolder = gui.addFolder("Spot Light");
  lightFolder.addColor(params, "color").onChange(function (val) {
    spotLight.color.set(val);
  });
  lightFolder.add(params, "intensity", 0, 2).onChange(function (val) {
    spotLight.intensity = val;
  });
  lightFolder.add(params, "distance", 0, 10).onChange(function (val) {
    spotLight.distance = val;
  });
  lightFolder.add(params, "angle", 0, Math.PI).onChange(function (val) {
    spotLight.angle = val;
  });
  lightFolder.add(params, "penumbra", 0, 1).onChange(function (val) {
    spotLight.penumbra = val;
  });
  lightFolder.add(params, "decay", 1, 2).onChange(function (val) {
    spotLight.decay = val;
  });

  // gui for bg shader
  const bgFolder = gui.addFolder("Background Shader");
  bgFolder.add(params, "total", 0, 200).onChange(function (val) {
    bgMaterial.uniforms.uTotal.value = val;
  });
  bgFolder.add(params, "minSize", 0, 10).onChange(function (val) {
    bgMaterial.uniforms.uMinSize.value = val;
  });
  bgFolder.add(params, "maxSize", 0, 10).onChange(function (val) {
    bgMaterial.uniforms.uMaxSize.value = val;
  });
  bgFolder.add(params, "yDistribution", 0, 1).onChange(function (val) {
    bgMaterial.uniforms.uYDistribution.value = val;
  });
  bgFolder.add(params, "noiseIntensity", 0, 10).onChange(function (val) {
    bgMaterial.uniforms.uNoiseIntensity.value = val;
  });
  bgFolder.add(params, "noiseDefinition", 0, 1).onChange(function (val) {
    bgMaterial.uniforms.uNoiseDefinition.value = val;
  });
  bgFolder.addColor(params, "bgColor").onChange(function (val) {
    bgMaterial.uniforms.bgColor.value = new THREE.Color(val);
  });
  bgFolder.addColor(params, "rectColor").onChange(function (val) {
    bgMaterial.uniforms.rectColor.value = new THREE.Color(val);
  });
  bgFolder
    .add(params.glowPos, "x", -10, 10)
    .onChange(function (val) {
      bgMaterial.uniforms.uGlowPos.value.x = val;
    })
    .name("glowPosX");
  bgFolder
    .add(params.glowPos, "y", -10, 10)
    .onChange(function (val) {
      bgMaterial.uniforms.uGlowPos.value.y = val;
    })
    .name("glowPosY");
  bgFolder.open();

  gui.close();
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);

  if (bgMaterial) {
    bgMaterial.uniforms.iResolution.value.set(
      window.innerWidth,
      window.innerHeight,
      1
    );
  }
  if (bgMesh) {
    const aspect = window.innerWidth / window.innerHeight;
    bgMesh.geometry = new THREE.PlaneGeometry(15 * aspect, 15);
  }
}

function onMouseMove(event: MouseEvent) {
  const x = event.clientX;
  const y = event.clientY;
  const width = window.innerWidth;
  const height = window.innerHeight;
  const mouseX = (x / width) * 2 - 1;
  const mouseY = -(y / height) * 2 + 1;
  const vector = new THREE.Vector3(mouseX, mouseY, 0.5);
  vector.unproject(camera);
  const dir = vector.sub(camera.position).normalize();
  const distance = -camera.position.z / dir.z - 1;
  const pos = camera.position.clone().add(dir.multiplyScalar(distance));
  spotLight.position.copy(pos);

  if (bgMaterial) {
    bgMaterial.uniforms.iMouse.value.x = x;
    bgMaterial.uniforms.iMouse.value.y = y;
  }
}

function animate() {
  const time = performance.now() / 3000;
  const scrollPosition = useLucy.getState().scrollPosition * 0.0021;

  if (lucyMesh) {
    lucyMesh.position.y = scrollPosition - 0.5;
    lucyMesh.rotation.y = scrollPosition;
  }
  if (bgMaterial) {
    bgMaterial.uniforms.iTime.value = time;
  }

  renderer.render(scene, camera);
}
