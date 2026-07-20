# Agent Guidelines & Design Instructions

These instructions represent the user's explicit design and structure preferences for files and slide decks in the `docs` folder. Follow them strictly.

## 🎨 Slide Deck Design Rules (Marp)
1. **Text Density**: Slide decks must be lean and scannable. Do not write text-heavy slides; let the core documents do the talking.
2. **Zero Emojis**: Emojis are strictly banned from slide layouts to preserve a professional engineering aesthetic.
3. **No Card Side Colors**: Purge left-border colored bars from card styles. Use clean border outlines (`border: 1px solid`) instead.
4. **No Drop Shadows on Diagrams**: Do not apply drop shadows (`box-shadow`) to diagram images. Since the PNGs have transparent backgrounds, drop shadows render as solid rectangles around the boundaries, which breaks the layout.
5. **Dead-Center Diagrams**: Large diagram images (like the Unified Class Diagram) must be sized appropriately and centered in the slide view. Use clean viewport limits (like `max-height: 520px`) and full-bleed slide layouts (`_padding: 20px 40px`) to prevent clipping.
6. **Move Secondary Details to Notes**: Place descriptive details, explanations, and flow triggers inside Marp presenter notes (`<!-- ... -->`) instead of printing them on the slide canvas.
7. **Problem Statement Typography**: Avoid small or nested card boxes for the problem statement. Display it cleanly with simple headers, blockquotes (`>`), and proper large typography.

## 📖 Story-Driven Requirements Presentation Flow
For requirements engineering workshops, organize slides around the following storytelling narrative:
* **Chapter 1: This is what happened** (The human delay bottleneck).
* **Chapter 2: This is specifically what happened** (The 5 Whys analysis).
* **Chapter 3: This is what we think happens** (Distinguishing hard facts from behavioral hypotheses):
  * **The Hard Fact (What we're working with)**
  * **The Hypothesis (What we think happens)**
  * *Must be aligned side-by-side in equal 50:50 columns starting at the same top-level line.*
* **Chapter 4: What we can do to make it work** (Translating pain to functional logic):
  * **Customer Pain Point**
  * **Functional Translation**
  * *Must be aligned side-by-side in equal 50:50 columns starting at the same top-level line.*
* **Key Constraints**: Operational constraints (SSO, sync time, adoption boundaries) listed simply and clearly.

## ⚙️ Project File Structure
* **Marp Backend Location**: The Marp build and packaging environment must always reside in [docs/lib/](file:///home/kaoru/Projects/softdev/docs/lib/). Do not move it outside to the root directory or subdirectories.
* **Symlinks**: Slide deck files use the `_deck.md` suffix (e.g. `system_architecture_deck.md` and `requirements_engineering_workshop_deck.md`) and are symlinked to `docs/lib/src/` for watching/compiling.
* **No Automated Compilation**: Do not compile presentations to HTML/PDF unless explicitly requested by the user.
* **Marp CLI Options**: To parse structural HTML grid layouts and load local image assets during exports (PDF/PPTX/HTML), all Marp commands must include the `--html` and `--allow-local-files` flags:
  * `"watch": "marp --html --allow-local-files -w -s -I src/"`
