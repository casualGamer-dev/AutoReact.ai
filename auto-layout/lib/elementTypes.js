// Shared with lib/detect.js (class-index decode), lib/codeGen.js (template
// lookup), and pages/reviewDetections.js (tap-to-correct class cycling) - one
// list instead of three copies that could drift.
export const ELEMENT_TYPES = ['Text', 'Textfield', 'Button', 'Image', 'Switch'];
