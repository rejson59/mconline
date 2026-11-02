import * as THREE from 'three';

/** The world (including all transparency) finishes before either held item.
 * renderOrder alone cannot move opaque held blocks past the transparent pass. */
export class FirstPersonView {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera();
  constructor(main: THREE.Group, off: THREE.Group) { this.scene.add(main, off); }
  render(renderer: THREE.WebGLRenderer, world: THREE.Scene, camera: THREE.PerspectiveCamera) {
    const autoClear = renderer.autoClear, autoReset = renderer.info.autoReset;
    renderer.info.reset();
    renderer.info.autoReset = false; // Count world + hands, not only the last pass.
    try {
      renderer.render(world, camera);
      this.camera.projectionMatrix.copy(camera.projectionMatrix);
      this.camera.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
      renderer.autoClear = false; // Keep world color; reset only its depth.
      renderer.clearDepth();
      renderer.render(this.scene, this.camera);
    } finally {
      renderer.autoClear = autoClear;
      renderer.info.autoReset = autoReset;
    }
  }
}
