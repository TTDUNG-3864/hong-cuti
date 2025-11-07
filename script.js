import * as THREE from "https://cdn.skypack.dev/three@0.135.0";
import { gsap } from "https://cdn.skypack.dev/gsap@3.8.0";
import { GLTFLoader } from "https://cdn.skypack.dev/three@0.135.0/examples/jsm/loaders/GLTFLoader";

class World {
  constructor({
    canvas,
    width,
    height,
    cameraPosition,
    fieldOfView = 75,
    nearPlane = 0.1,
    farPlane = 100
  })
   {
    this.parameters = {
      count: 3000, 
      max: 12.5 * Math.PI,
      a: 2, c: 4.5
    };

    // === BẮT ĐẦU THAY THẾ (Dòng 21) ===
    
    // 1. Tính toán tạm thời để set config ban đầu
    const initialWidth = window.innerWidth;
    const initialHeight = window.innerHeight;
    const isMobilePortrait = initialWidth < 600 && initialHeight > initialWidth;
    const isMobileLandscape = initialHeight < 500 && initialWidth > initialHeight;
    const isMobile = isMobilePortrait || isMobileLandscape;
    
    // 2. Đặt particleCount (số tim) chuẩn ngay từ đầu
    // (Ít tim hơn khi xoay ngang vì lag)
    const initialParticleCount = isMobile ? (isMobileLandscape ? 1000 : 1500) : 3000;

    this.config = {
      // Tự động giảm hạt nếu là di động (Fix lag)
      particleCount: initialParticleCount, 
      
      // Kích thước/Zoom sẽ được hàm mới đặt, đây là mặc định
      particleSize: 0.2, 
      
      speed: 0.0005,
      colorScheme: 'tim1_original',
      
      // Kích thước/Zoom sẽ được hàm mới đặt, đây là mặc định
      heartZoom: 0.08, 
      
      floatingHeartColor: 'original',
    };
    // === KẾT THÚC THAY THẾ (Dòng 34) ===

    // Biến để điều khiển interval
    this.customImageSpawner = null;
    this.customImageInterval = null;
    this.loveTextLeft = document.getElementById('love-text-left');
    this.loveTextRight = document.getElementById('love-text-right');
    this.loveTextLeftContent = this.loveTextLeft ? this.loveTextLeft.querySelector('.love-text-content') : null;
    this.loveTextRightContent = this.loveTextRight ? this.loveTextRight.querySelector('.love-text-content') : null;
    this.originalLeftText = this.loveTextLeftContent ? this.loveTextLeftContent.textContent.trim() : "";
    this.originalRightText = this.loveTextRightContent ? this.loveTextRightContent.textContent.trim() : "";
    this.leftTypingInterval = null;
    this.rightTypingInterval = null;
    this.lastCustomImageLeft = -999;

    this.textureLoader = new THREE.TextureLoader();
    this.gltfLoader = new GLTFLoader(); 
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    this.clock = new THREE.Clock();
    this.data = 0;
    this.time = { current: 0, t0: 0, t1: 0, t: 0, frequency: this.config.speed };
    this.angle = { x: 0, z: 0 };
    this.width = width || document.documentElement.clientWidth;
    this.height = height || document.documentElement.clientHeight;
    this.aspectRatio = this.width / this.height;
    this.fieldOfView = fieldOfView;
    this.camera = new THREE.PerspectiveCamera(
      fieldOfView, this.aspectRatio, nearPlane, farPlane
    );

    this.camera.position.set(
      cameraPosition.x, cameraPosition.y, cameraPosition.z
    );

    this.scene.add(this.camera);
    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: true
    });

    this.pixelRatio = Math.min(window.devicePixelRatio, 2);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(this.width, this.height);
    this.timer = 0;
    
    this.addToScene();
    
    this.setupControls(); 
    this.setupStartButton(); 
    
    this.setupFloatingImages(); // Khôi phục tim bay PNG
    this.setupCustomFloatingImages(); // Thêm ảnh tùy chỉnh

    this.updateLayoutBasedOnScreen(); // <-- THÊM DÒNG NÀY ĐỂ CHẠY LẦN ĐẦU

    this.render();
    this.listenToResize();
    this.listenToMouseMove();
  }

  // === HÀM MỚI DÀNH RIÊNG CHO VIỆC TÍNH TOÁN KÍCH THƯỚC ===
  updateLayoutBasedOnScreen() {
    // 1. Lấy kích thước MỚI NHẤT
    const width = document.documentElement.clientWidth;
    const height = document.documentElement.clientHeight;

    // 2. Xác định trạng thái (Mobile Dọc, Mobile Ngang, hay Desktop)
    const isMobilePortrait = width < 600 && height > width;
    const isMobileLandscape = height < 500 && width > height; // Màn hình lùn (ngang)
    const isMobile = isMobilePortrait || isMobileLandscape;

    let newHeartZoom;
    let newParticleSize;
    let bodyClassList = []; // Dùng mảng để chứa class

    if (isMobilePortrait) {
      // --- Cấu hình Di Động DỌC ---
      newHeartZoom = 0.065;    // Tim 3D (vừa)
      newParticleSize = 0.15;   // Tim chính (vừa)
      bodyClassList.push('mobile-layout', 'portrait-layout');
      
    } else if (isMobileLandscape) {
      // --- Cấu hình Di Động NGANG ---
      newHeartZoom = 0.050;    // Tim 3D (nhỏ)
      newParticleSize = 0.12;   // Tim chính (nhỏ)
      bodyClassList.push('mobile-layout', 'landscape-layout');

    } else {
      // --- Cấu hình Desktop ---
      newHeartZoom = 0.08;     // Tim 3D (mặc định)
      newParticleSize = 0.2;    // Tim chính (mặc định)
      bodyClassList.push('desktop-layout');
    }

    // 3. Cập nhật config
    this.config.heartZoom = newHeartZoom;
    this.config.particleSize = newParticleSize;
    
    // 4. Cập nhật "live" các giá trị Three.js
    if (this.heartMaterial) {
      // Cập nhật tim 3D
      this.heartMaterial.uniforms.uHeartRadius.value = newHeartZoom;
      // Cập nhật tim chính
      this.heartMaterial.uniforms.uSize.value = newParticleSize;
    }

    // 5. Cập nhật thanh trượt (slider) cho đồng bộ
    const zoomSlider = document.getElementById('heartZoom');
    const zoomValue = document.getElementById('heartZoomValue');
    if (zoomSlider) zoomSlider.value = newHeartZoom;
    if (zoomValue) zoomValue.textContent = newHeartZoom.toFixed(3);
    
    const sizeSlider = document.getElementById('particleSize');
    const sizeValue = document.getElementById('particleSizeValue');
    if (sizeSlider) sizeSlider.value = newParticleSize;
    if (sizeValue) sizeValue.textContent = newParticleSize.toFixed(2);

    // 6. Cập nhật class CSS trên <body> (quan trọng cho bảng lệnh)
    // Lấy các class màu viền/tim bay cũ
    const floatingColorClass = document.body.className.match(/floating-color-\S+/g) || [];
    const borderColorClass = document.body.className.match(/border-rainbow/g) || [];
    
    // Set class mới, giữ lại class màu cũ
    document.body.className = [...bodyClassList, ...floatingColorClass, ...borderColorClass].join(' ');
  }
  // === KẾT THÚC HÀM MỚI ===

  // === HÀM MỚI ĐỂ GÕ CHỮ (JAVASCRIPT) ===
  typewriter(element, text, duration, onComplete = null) {
    // Lấy text, chuẩn bị
    const textToType = text;
    const charCount = textToType.length;
    if (charCount === 0) {
        if(onComplete) onComplete();
        return;
    }
    const charInterval = duration / charCount; // Thời gian cho mỗi ký tự
    
    element.innerHTML = ''; // Xóa sạch text
    element.classList.remove('hide-text');
    element.classList.add('start-typing'); // Thêm class (cho dấu nháy)
    
    let charIndex = 0;
    
    // Dừng interval cũ (nếu có)
    if (element === this.loveTextLeftContent && this.leftTypingInterval) {
        clearInterval(this.leftTypingInterval);
    }
    if (element === this.loveTextRightContent && this.rightTypingInterval) {
        clearInterval(this.rightTypingInterval);
    }

    const typingInterval = setInterval(() => {
        if (charIndex < charCount) {
            const char = textToType[charIndex];
            // Nếu là ký tự xuống dòng, chèn <br>
            if (char === '\n') {
                element.innerHTML += '<br>';
            } else {
                element.innerHTML += char;
            }
            charIndex++;
        } else {
            clearInterval(typingInterval);
            // Khi gõ xong, tắt dấu nháy
            element.classList.remove('start-typing'); 
            element.style.borderBottom = '2px solid transparent'; // Giữ lại lề
            
            if (onComplete) {
                onComplete();
            }
        }
    }, charInterval);

    // Lưu interval mới
    if (element === this.loveTextLeftContent) {
        this.leftTypingInterval = typingInterval;
    } else {
        this.rightTypingInterval = typingInterval;
    }
  }
  // === KẾT THÚC HÀM MỚI ===

  // 4 HÀM HELPER ẨN/HIỆN
  hideStartButton() {
    gsap.to(this.audioBtn, { 
      opacity: 0, 
      duration: 1, 
      ease: "power1.out",
      onComplete: () => this.audioBtn.style.display = 'none' 
    });
  }

  showStartButton() {
    gsap.to(this.audioBtn, {
        opacity: 1,
        duration: 1,
        ease: "power1.out",
        onStart: () => {
            this.audioBtn.style.display = 'block'; 
            this.audioBtn.textContent = "Bắt đầu";
            this.audioBtn.disabled = false;
        }
    });
  }

  hideControls() {
    gsap.to(this.controlsContainer, { 
      opacity: 0, 
      duration: 1, 
      ease: "power1.out", 
      onComplete: () => this.controlsContainer.style.display = 'none' 
    });
  }

  showControls() {
    gsap.to(this.controlsContainer, { 
        opacity: 1, 
        duration: 1, 
        ease: "power1.out", 
        onStart: () => this.controlsContainer.style.display = 'block' 
    });
  }
  startTextAnimation() {
    if (!this.loveTextLeftContent || !this.loveTextRightContent) return;

    // LÀM MỜ HIỆN DIV CHA (SỬA Ở ĐÂY)
    if (this.loveTextLeft) this.loveTextLeft.style.opacity = 1;

    // Xóa class, chuẩn bị (trên thẻ <p> con)
    this.loveTextLeftContent.classList.remove('hide-text');
    this.loveTextRightContent.classList.remove('hide-text');
    this.loveTextLeftContent.innerHTML = ''; // Xóa nội dung cũ
    this.loveTextRightContent.innerHTML = ''; // Xóa nội dung cũ
    
    const tl = gsap.timeline();
    
    // 2s: Bắt đầu gõ bên trái (gõ trong 5 giây)
    tl.call(() => {
        // Dùng text gốc đã lưu trong constructor
        this.typewriter(this.loveTextLeftContent, this.originalLeftText, 5000, () => {
            // Khi bên trái gõ xong, 0.5s sau, gõ bên phải
            setTimeout(() => {
                // LÀM MỜ HIỆN DIV CHA BÊN PHẢI (SỬA Ở ĐÂY)
                if (this.loveTextRight) this.loveTextRight.style.opacity = 1;
                // Dùng text gốc đã lưu
                this.typewriter(this.loveTextRightContent, this.originalRightText, 6000);
            }, 500); // Nghỉ 0.5s
        });
    }, null, 2.0); // Chờ 2 giây rồi mới bắt đầu
  }
  
  resetTextAnimation() {
    // Dừng mọi interval đang gõ (nếu nhạc dừng đột ngột)
    if (this.leftTypingInterval) clearInterval(this.leftTypingInterval);
    if (this.rightTypingInterval) clearInterval(this.rightTypingInterval);

    if (!this.loveTextLeftContent || !this.loveTextRightContent) return;
    
    // LÀM MỜ ẨN DIV CHA (SỬA Ở ĐÂY)
    if (this.loveTextLeft) this.loveTextLeft.style.opacity = 0;
    if (this.loveTextRight) this.loveTextRight.style.opacity = 0;
    
    // Thêm class ẩn (CSS sẽ xử lý) (trên thẻ <p> con)
    this.loveTextLeftContent.classList.add('hide-text');
    this.loveTextRightContent.classList.add('hide-text');
    
    // Xóa class chạy
    this.loveTextLeftContent.classList.remove('start-typing');
    this.loveTextRightContent.classList.remove('start-typing');
    
    // Đặt lại nội dung (để chuẩn bị cho lần chạy sau)
    this.loveTextLeftContent.innerHTML = '';
    this.loveTextRightContent.innerHTML = '';

    // Khôi phục dấu nháy (chuẩn bị cho lần sau)
    this.loveTextLeftContent.style.borderBottom = '2px solid transparent';
    this.loveTextRightContent.style.borderBottom = '2px solid transparent';
  }
  start() {}

  render() {
    this.renderer.render(this.scene, this.camera);
    this.composer && this.composer.render();
  }

  loop() {
    this.time.elapsed = this.clock.getElapsedTime();
    this.time.delta = Math.min(
      60, (this.time.current - this.time.elapsed) * 1000
    );

    if (this.analyser && this.isRunning) {
      this.time.t = this.time.elapsed - this.time.t0 + this.time.t1;
      this.data = this.analyser.getAverageFrequency();
      this.data *= this.data / 2000;
      this.angle.x += this.time.delta * 0.001 * 0.63;
      this.angle.z += this.time.delta * 0.001 * 0.39;
      const justFinished = this.isRunning && !this.sound.isPlaying;
      
      if (justFinished) {
        this.time.t1 = this.time.t;
        this.isRunning = false;
        const tl = gsap.timeline();
        this.angle.x = 0;
        this.angle.z = 0;
        tl.to(this.camera.position, {
          x: 0, z: 4.5, duration: 4, ease: "expo.in"
        });

        this.showStartButton();
        this.showControls();
        this.resetTextAnimation();
        
        // Dừng và xóa ảnh tùy chỉnh
        if (this.customImageInterval) {
            clearInterval(this.customImageInterval);
            this.customImageInterval = null;
        }
        document.querySelectorAll('.custom-floating-image').forEach(img => img.remove());
        
      } else {
        this.camera.position.x = Math.sin(this.angle.x) * this.parameters.a;
        this.camera.position.z = Math.min(
          Math.max(Math.cos(this.angle.z) * this.parameters.c, 1.75), 6.5
        );
      }
    }
    this.camera.lookAt(this.scene.position);

    if (this.heartMaterial) {
      this.heartMaterial.uniforms.uTime.value +=
        this.time.delta * this.config.speed * (1 + this.data * 0.2); 
      // Kích thước và Zoom đã được updateLayoutBasedOnScreen() xử lý
      // this.heartMaterial.uniforms.uSize.value = this.config.particleSize;
      // this.heartMaterial.uniforms.uHeartRadius.value = this.config.heartZoom;
    }
    
    if (this.model) {
      this.model.rotation.y -= 0.0005 * this.time.delta * (1 + this.data);
      this.model.position.y = -this.config.heartZoom * 2.5;
    }

    // KHÔI PHỤC "NỀN TIM" (SNOW)
    if (this.snowMaterial) {
      this.snowMaterial.uniforms.uTime.value +=
        this.time.delta * 0.0004 * (1 + this.data);
    }
    if(this.loveTextLeft) {
        // Tính toán độ rộng (tính bằng vw)
        // khoảng cách
        const baseWidthVw = 2;
        const dynamicWidthVw = (this.config.heartZoom / 0.08) * 15; // Tăng khoảng cách khi zoom
        document.documentElement.style.setProperty('--heart-width-offset', `${baseWidthVw}vw`);

        // Tính toán vị trí Y (tính bằng %)
        const yOffsetPercent = (this.config.heartZoom / 0.08 - 1) * -30; // Di chuyển -30% khi zoom
        document.documentElement.style.setProperty('--heart-y-offset', `${-50 + yOffsetPercent}%`); // Bắt đầu ở -50% (giữa)
    }
    
    this.render();

    this.time.current = this.time.elapsed;
    requestAnimationFrame(this.loop.bind(this));
  }

  // === BẮT ĐẦU THAY THẾ (Dòng 318) ===
  listenToResize() {
    window.addEventListener('resize', () => {
      // 1. Cập nhật kích thước cơ bản cho Three.js
      this.width = document.documentElement.clientWidth;
      this.height = document.documentElement.clientHeight;
      this.renderer.setSize(this.width, this.height);
      this.camera.aspect = this.width / this.height;
      this.camera.updateProjectionMatrix();

      // 2. Gọi hàm tính toán layout tổng
      // Hàm này sẽ tự xử lý (tim 3D, tim chính, bảng lệnh)
      this.updateLayoutBasedOnScreen();
    });
  }
  // === KẾT THÚC THAY THẾ (Dòng 348) ===

  listenToMouseMove() {
    window.addEventListener("mousemove", e => {
      gsap.to(this.camera.position, {
        x: gsap.utils.mapRange(0, window.innerWidth, 0.2, -0.2, e.clientX),
        y: gsap.utils.mapRange(0, window.innerHeight, 0.2, -0.2, -e.clientY)
      });
    });
    window.addEventListener("mouseleave", () => {});
  }

  updateHeartParticles() {
      if (this.heart) {
          this.scene.remove(this.heart);
          this.heart.geometry.dispose();
          this.heart.material.dispose();
      }
      this.addHeart();
  }

  addHeart() {
    this.heartMaterial = new THREE.ShaderMaterial({
      fragmentShader: document.getElementById("fragmentShader").textContent,
      vertexShader: document.getElementById("vertexShader").textContent,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: this.config.particleSize },
        uTex: { value: new THREE.TextureLoader().load("heart1.png") },
        uHeartRadius: { value: this.config.heartZoom }
      },
      depthWrite: false, 
      blending: THREE.AdditiveBlending,
      transparent: true
    });

    const count = this.config.particleCount;
    const scales = new Float32Array(count * 1);
    const colors = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    const randoms = new Float32Array(count);
    const randoms1 = new Float32Array(count);

    const squareGeometry = new THREE.PlaneGeometry(1, 1);
    this.instancedGeometry = new THREE.InstancedBufferGeometry();
    Object.keys(squareGeometry.attributes).forEach(attr => {
      this.instancedGeometry.attributes[attr] = squareGeometry.attributes[attr];
    });
    this.instancedGeometry.index = squareGeometry.index;
    this.instancedGeometry.maxInstancedCount = count;

    const colorChoices = {
        rainbow: [ new THREE.Color("#ff0000"), new THREE.Color("#ffa500"), new THREE.Color("#ffff00"), new THREE.Color("#00ff00"), new THREE.Color("#0000ff"), new THREE.Color("#4b0082"), new THREE.Color("#ee82ee") ],
        red: [new THREE.Color("#ff0000"), new THREE.Color("#ff3333"), new THREE.Color("#cc0000")],
        green: [new THREE.Color("#00ff00"), new THREE.Color("#33ff33"), new THREE.Color("#00cc00")],
        blue: [new THREE.Color("#0000ff"), new THREE.Color("#3333ff"), new THREE.Color("#0000cc")],
        monochrome: [new THREE.Color("#ffffff"), new THREE.Color("#cccccc"), new THREE.Color("#999999")],
        tim1_original: [ new THREE.Color("#ff66cc"), new THREE.Color("#ff99ff"), new THREE.Color("#ffccff"), new THREE.Color("#ff3366"), new THREE.Color("#ffffff") ]
    };
    const currentColors = colorChoices[this.config.colorScheme] || colorChoices['tim1_original'];

    for (let i = 0; i < count; i++) {
      randoms[i] = Math.random();
      randoms1[i] = Math.random();
      scales[i] = Math.random() * 0.35;
      const colorIndex = Math.floor(Math.random() * currentColors.length);
      const color = currentColors[colorIndex];
      const i3 = 3 * i;
      colors[i3 + 0] = color.r; colors[i3 + 1] = color.g; colors[i3 + 2] = color.b;
      speeds[i] = Math.random() * this.parameters.max;
    }
    this.instancedGeometry.setAttribute( "random", new THREE.InstancedBufferAttribute(randoms, 1, false) );
    this.instancedGeometry.setAttribute( "random1", new THREE.InstancedBufferAttribute(randoms1, 1, false) );
    this.instancedGeometry.setAttribute( "aScale", new THREE.InstancedBufferAttribute(scales, 1, false) );
    this.instancedGeometry.setAttribute( "aSpeed", new THREE.InstancedBufferAttribute(speeds, 1, false) );
    this.instancedGeometry.setAttribute( "aColor", new THREE.InstancedBufferAttribute(colors, 3, false) );

    this.heart = new THREE.Mesh(this.instancedGeometry, this.heartMaterial);
    this.heart.renderOrder = 2; 
    this.scene.add(this.heart);
  }

  addToScene() {
    this.addModel();
    this.addHeart();
    this.addSnow();
  }

  // === KHÔI PHỤC TIM 3D (addModel) ===
  addModel() {
    this.gltfLoader.load(
      "heart.glb", 
      (gltf) => {
        this.model = gltf.scene; 
        this.model.scale.set(0.001, 0.001, 0.001); 
        this.model.renderOrder = 1;
  
        this.model.traverse((child) => {
          if (child.isMesh) {
            child.material = new THREE.MeshMatcapMaterial({
              matcap: this.textureLoader.load(
                "3.png", 
                () => {
                  gsap.to(this.model.scale, {
                    x: 0.25, y: 0.25, z: 0.25,
                    duration: 1.5, ease: "Elastic.easeOut"
                  });
                }
              ),
              color: "#ff3366"
            });
          }
        });
  
        this.scene.add(this.model); 
      },
      undefined, 
      (error) => {
        console.error("Lỗi nghiêm trọng khi tải heart.glb:", error);
      }
    );
  }
  
  setupStartButton() {
    this.audioBtn = document.querySelector("button#startButton");
    this.audioBtn.addEventListener("click", () => {
      this.audioBtn.disabled = true;
      
      this.hideStartButton();
      this.hideControls();
      this.startTextAnimation();

      // Bắt đầu chạy hàm spawner ảnh tùy chỉnh
      if (this.spawnCustomImage) {
          this.spawnCustomImage(); // Tạo 1 ảnh ngay lập tức
          this.customImageInterval = setInterval(this.spawnCustomImage, 1000 + Math.random() * 500); // độ dày ảnh
      }

      if (this.analyser) {
        this.sound.play();
        this.time.t0 = this.time.elapsed;
        this.data = 0;
        this.isRunning = true;
      } else {
        this.audioBtn.textContent = "Đang tải nhạc...";
        this.loadMusic().then(() => {
          console.log("music loaded");
        });
      }
    });
  }

  loadMusic() {
    return new Promise(resolve => {
      const listener = new THREE.AudioListener();
      this.camera.add(listener);
      this.sound = new THREE.Audio(listener);
      const audioLoader = new THREE.AudioLoader();
      audioLoader.load(
        "nhac.mp3", // <-- Đã sửa tên nhạc
        buffer => {
          this.sound.setBuffer(buffer);
          this.sound.setLoop(false);
          this.sound.setVolume(0.5);
          this.sound.play();
          this.analyser = new THREE.AudioAnalyser(this.sound, 32);
          const data = this.analyser.getAverageFrequency();
          this.isRunning = true;
          this.t0 = this.time.elapsed;
          this.audioBtn.textContent = "Bắt đầu";
          resolve(data);
        },
        progress => {},
        error => {
          console.log(error);
          this.audioBtn.textContent = "Lỗi tải nhạc";
        }
      );
    });
  }

  // === KHÔI PHỤC "NỀN TIM" (SNOW) ===
  addSnow() {
    this.snowMaterial = new THREE.ShaderMaterial({
      fragmentShader: document.getElementById("fragmentShader1").textContent,
      vertexShader: document.getElementById("vertexShader1").textContent,
      uniforms: {
        uTime: { value: 0 }, uSize: { value: 0.3 },
        uTex: { value: new THREE.TextureLoader().load("heart1.png") }
      },
      depthWrite: false, 
      blending: THREE.AdditiveBlending,
      transparent: true
    });

    const count = 550;
    const scales = new Float32Array(count * 1);
    const colors = new Float32Array(count * 3);
    const phis = new Float32Array(count);
    const randoms = new Float32Array(count);
    const randoms1 = new Float32Array(count);
    const colorChoices = [ "#ff66cc", "#ff99ff", "#ffccff", "#ffffff" ];
    const squareGeometry = new THREE.PlaneGeometry(1, 1);
    this.instancedGeometrySnow = new THREE.InstancedBufferGeometry();
    Object.keys(squareGeometry.attributes).forEach(attr => {
      this.instancedGeometrySnow.attributes[attr] = squareGeometry.attributes[attr];
    });
    this.instancedGeometrySnow.index = squareGeometry.index;
    this.instancedGeometrySnow.maxInstancedCount = count;
    for (let i = 0; i < count; i++) {
      const phi = (Math.random() - 0.5) * 10;
      const i3 = 3 * i;
      phis[i] = phi; randoms[i] = Math.random(); randoms1[i] = Math.random();
      scales[i] = Math.random() * 0.35;
      const colorIndex = Math.floor(Math.random() * colorChoices.length);
      const color = new THREE.Color(colorChoices[colorIndex]);
      colors[i3 + 0] = color.r; colors[i3 + 1] = color.g; colors[i3 + 2] = color.b;
    }
    this.instancedGeometrySnow.setAttribute( "phi", new THREE.InstancedBufferAttribute(phis, 1, false) );
    this.instancedGeometrySnow.setAttribute( "random", new THREE.InstancedBufferAttribute(randoms, 1, false) );
    this.instancedGeometrySnow.setAttribute( "random1", new THREE.InstancedBufferAttribute(randoms1, 1, false) );
    this.instancedGeometrySnow.setAttribute( "aScale", new THREE.InstancedBufferAttribute(scales, 1, false) );
    this.instancedGeometrySnow.setAttribute( "aColor", new THREE.InstancedBufferAttribute(colors, 3, false) );
    
    this.snow = new THREE.Mesh(this.instancedGeometrySnow, this.snowMaterial);
    this.snow.renderOrder = 3; 
    this.scene.add(this.snow);
  }

  // === KHÔI PHỤC TIM BAY PNG (heart.png) ===
  setupFloatingImages() {
    const imageSrc = 'heart1.png';
    const spawnFloatingImage = () => {
      try {
        const img = new Image();
        img.src = imageSrc;
        img.classList.add('floating-heart'); 
        img.style.left = Math.random() * window.innerWidth + 'px';
        img.style.bottom = '-100px';
        img.style.width = (50 + Math.random() * 50) + 'px';
        img.style.opacity = '0.7';
        document.body.appendChild(img);
        setTimeout(() => {
          img.style.transform = `translateY(-${window.innerHeight + 200}px) scale(${1 + Math.random() * 0.5})`;
          img.style.opacity = '0';
        }, 50);
        setTimeout(() => img.remove(), 10000 + Math.random() * 2000); //độ dày tim
      } catch (e) {
        console.warn("Không thể tạo ảnh bay, bạn có file heart.png không?");
      }
    };
    setInterval(spawnFloatingImage, 450 + Math.random() * 250);
  }
  
  // === HÀM MỚI: TẠO ẢNH (anh1.png, anh2.png) BAY LÊN ===
  // thêm ảnh
  setupCustomFloatingImages() {
      const customImageSources = ['anh1.png', 'anh2.png','anh3.png','anh4.png','anh5.png','anh6.png','anh7.png'];
      
      // Đây là hàm sẽ được gọi lặp lại
      this.spawnCustomImage = () => { 
        try {
          const imageSrc = customImageSources[Math.floor(Math.random() * customImageSources.length)];
          const img = new Image();
          img.src = imageSrc;

          // === LOGIC MỚI CHỐNG CHỒNG CHÉO ===
          const imgWidth = 125; // Kích thước ảnh trung bình (từ 100-150px)
          const minDistance = imgWidth + 20; // Giữ khoảng cách tối thiểu (rộng 125 + 20px đệm)
          
          // Tạo vị trí, đảm bảo ảnh không bị tràn lề phải
          let newLeft = Math.random() * (window.innerWidth - imgWidth); 
          
          // Kiểm tra xem có quá gần ảnh trước không
          if (this.lastCustomImageLeft > -999) { // Chỉ chạy nếu đây ko phải ảnh đầu tiên
              if (Math.abs(newLeft - this.lastCustomImageLeft) < minDistance) {
                  // Nếu quá gần, đẩy nó ra xa, và % để nó quay vòng
                  newLeft = (this.lastCustomImageLeft + minDistance) % (window.innerWidth - imgWidth);
              }
          }
          this.lastCustomImageLeft = newLeft; // Lưu vị trí mới cho lần sau
          // === KẾT THÚC LOGIC MỚI ===

          img.classList.add('custom-floating-image'); 
          img.style.left = newLeft + 'px'; // <-- Dùng vị trí mới đã tính
          img.style.bottom = '-150px'; 
          img.style.width = (100 + Math.random() * 50) + 'px'; 
          img.style.opacity = '0.8';
          document.body.appendChild(img);
          
          setTimeout(() => {
            img.style.transform = `translateY(-${window.innerHeight + 200}px) scale(${1 + Math.random() * 0.5})`;
            img.style.opacity = '0';
          }, 50);
          
          setTimeout(() => img.remove(), 12000 + Math.random() * 2000); 
        } catch (e) {
          console.warn("Không thể tạo ảnh tùy chỉnh, bạn có file anh1.png/anh2.png không?");
        }
      };
      // === KẾT THÚC THAY THẾ ===
  }

  setupControls() {
    this.controlsContainer = document.getElementById('controls-container'); 
    
    const controls = document.getElementById('controls');
    let controlsVisible = true;
    
    const floatingColorClasses = ['original', 'red', 'green', 'blue', 'monochrome', 'rainbow'];
    const updateFloatingHeartColor = (newColor) => {
        // Xóa class màu cũ
        floatingColorClasses.forEach(color => {
            document.body.classList.remove(`floating-color-${color}`);
        });
        // Thêm class màu mới
        document.body.classList.add(`floating-color-${newColor}`);
    };
    
    document.getElementById('toggle-controls').addEventListener('click', () => {
        controlsVisible = !controlsVisible;
        controls.style.display = controlsVisible ? 'block' : 'none';
        document.getElementById('toggle-controls').textContent = controlsVisible ? 'Hide Controls' : 'Show Controls';
    });
    document.getElementById('toggle-fullscreen').addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            if (document.exitFullscreen) document.exitFullscreen();
        }
    });

    const updateControl = (id, configKey, isFloat = false) => {
        const element = document.getElementById(id);
        const valueDisplay = document.getElementById(`${id}Value`);
        
        element.value = this.config[configKey];
        
        element.addEventListener('input', (e) => {
            let value = isFloat ? parseFloat(e.target.value) : (e.target.type === 'select-one' ? e.target.value : parseInt(e.target.value));
            this.config[configKey] = value; 
            
            if (valueDisplay) {
                if (typeof value === 'number') {
                    valueDisplay.textContent = value.toFixed(isFloat ? 4 : 0);
                } else {
                    valueDisplay.textContent = value; 
                }
            }
            
            if (configKey === 'particleCount' || configKey === 'colorScheme') {
                this.updateHeartParticles();
                }  
                else if (configKey === 'borderColorScheme') {
                this.updateBorderColor(value); // Chỉ gọi khi đổi màu viền
                }
                else if (configKey === 'particleSize') {
                if (this.heartMaterial) this.heartMaterial.uniforms.uSize.value = value;
            } else if (configKey === 'speed') {
            } else if (configKey === 'heartZoom') {
                if (this.heartMaterial) this.heartMaterial.uniforms.uHeartRadius.value = value;
            }
            else if (configKey === 'floatingHeartColor') {
                updateFloatingHeartColor(value); 
            }
        });
        
        if (valueDisplay) {
            if (typeof this.config[configKey] === 'number') {
                valueDisplay.textContent = this.config[configKey].toFixed(isFloat ? 4 : 0);
            }
        }
        if (element.type === 'select-one') {
             if (valueDisplay) valueDisplay.textContent = ''; 
        }
    };

    updateControl('colorScheme', 'colorScheme');
    
    updateControl('particleSize', 'particleSize', true);
    updateControl('particleCount', 'particleCount');
    updateControl('speed', 'speed', true); 
    updateControl('heartZoom', 'heartZoom', true);
    updateControl('borderColorScheme', 'borderColorScheme'); // Đăng ký control mới
    this.updateBorderColor(this.config.borderColorScheme);
    
    updateControl('floatingHeartColor', 'floatingHeartColor');
    updateFloatingHeartColor(this.config.floatingHeartColor);
  }
  updateBorderColor(scheme) {
    const root = document.documentElement;
    const body = document.body;

    // Định nghĩa các cặp màu cho viền/bóng
    const colorMap = {
        'red':          { border: '#ff0000', shadow: 'rgba(255, 0, 0, 0.5)' },
        'green':        { border: '#00ff00', shadow: 'rgba(0, 255, 0, 0.5)' },
        'blue':         { border: '#0000ff', shadow: 'rgba(0, 0, 255, 0.5)' },
        'monochrome':   { border: '#ffffff', shadow: 'rgba(255, 255, 255, 0.5)' },
        'tim1_original':{ border: '#ff66cc', shadow: 'rgba(255, 102, 204, 0.5)' }
    };

    // 1. Luôn xóa class rainbow cũ (nếu có)
    body.classList.remove('border-rainbow');

    if (scheme === 'rainbow') {
        // 2. Nếu là rainbow, thêm class để CSS tự chạy animation
        body.classList.add('border-rainbow');
        // Xóa biến đi để animation CSS hoạt động
        root.style.setProperty('--border-color', null);
        root.style.setProperty('--border-shadow', null);
    } else {
        // 3. Nếu là màu tĩnh, lấy màu từ colorMap
        const colors = colorMap[scheme] || colorMap['tim1_original']; // Lấy màu hoặc dùng màu hồng mặc định
        root.style.setProperty('--border-color', colors.border);
        root.style.setProperty('--border-shadow', colors.shadow);
    }
  }
}

const world = new World({
  canvas: document.querySelector("canvas.webgl"),
  cameraPosition: { x: 0, y: 0, z: 4.5 }
});

world.loop();