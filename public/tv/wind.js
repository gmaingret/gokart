// Gentle wind sway for instanced scenery: vertices bend more the higher they
// are, with a phase that varies per instance so a forest doesn't move in sync.
export const wind = { value: 0 };

export function addWind(material, amount = 0.035) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWind = wind;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWind;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec2 wp = instanceMatrix[3].xz;
        #else
          vec2 wp = vec2(0.0);
        #endif
        float sway = sin(uWind * 1.7 + wp.x * 0.13 + wp.y * 0.11) + 0.4 * sin(uWind * 3.1 + wp.x * 0.3);
        float bend = max(transformed.y, 0.0);
        transformed.x += sway * bend * ${amount.toFixed(4)};
        transformed.z += sway * bend * ${(amount * 0.6).toFixed(4)};`
      );
  };
  material.customProgramCacheKey = () => `wind${amount}`;
  return material;
}
