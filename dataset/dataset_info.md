# SignVision — Dataset Architecture & Linguistic Annotations (`dataset_info.md`)

> **Comprehensive specification for the raw sign language datasets, alphabetical partitions, HamNoSys phonetics, and compilation workflows.**

---

## ⚡ 1. Brief Vocabulary Summary (TL;DR)

The `dataset/` directory contains the raw sign language dataset partitioned alphabetically into individual JSON files:

### Quick Structure
- **Alphabetical Partitions**: `a.json` through `z.json` (26 files containing isolated word definitions).
- **Numbers Partition**: `numbers.json` (sign definitions for digits 0–9 and composite numerals).
- **Vocabulary Source**: `words.txt` (newline-delimited list of 1,500+ supported English vocabulary words).
- **Linguistic Standard**: Encoded using the Hamburg Notation System (HamNoSys) for phonetic sign description.

---

## 🛠️ 2. Detailed Technical Specification

### 2.1 File Partitioning & Schema

To facilitate collaborative dataset expansion and version control without file conflicts, vocabulary entries are partitioned by initial letter:

```
dataset/
├── a.json                       # Signs starting with 'A' (e.g. APPLE, AIRPLANE)
├── b.json                       # Signs starting with 'B' (e.g. BOY, BOOK, BROTHER)
│   ...
├── z.json                       # Signs starting with 'Z' (e.g. ZERO, ZEBRA)
├── numbers.json                 # Numeric signs (0 - 100+)
├── words.txt                    # Master word list index
└── dataset_info.md              # This reference manual
```

#### Individual Entry Schema
```json
[
  {
    "word": "APPLE",
    "hamnosys": "hamfinger2 hamthumbacross hamfingerstraight hamfist",
    "category": "food",
    "synonyms": ["FRUIT", "RED APPLE"],
    "motion_type": "repetitive"
  }
]
```

---

### 2.2 HamNoSys (Hamburg Notation System)

HamNoSys provides a phonetic representation of sign language analogous to the International Phonetic Alphabet (IPA) for spoken languages.

#### Component Primitives:
1. **Handshape (`hamfinger...`)**: Specifies the basic finger extension and flexion (e.g., fist, flat hand, index point, thumb cross).
2. **Orientation (`hamthumbacross...`)**: Encodes the direction of the palm and extended fingers relative to the signer's body.
3. **Location (`hamchest`, `hamhead`, `hammouth`)**: Defines the anchor position in 3D space where the sign is articulated.
4. **Action (`hammotion...`)**: Encodes trajectory dynamics (linear strokes, rotations, oscillations, or contact taps).

The CWASA avatar engine compiles these HamNoSys primitives into bone transformation matrices in real time.

---

### 2.3 Compilation into `data/sign_language_data.json`

The raw partition files are compiled into the master lookup dictionary used by the runtime:

```
[dataset/*.json] ──► [compile_dictionary.py] ──► [data/sign_language_data.json]
                                             └──► [Application/src/data/sign_language_data.json]
```

#### Ingestion Workflow:
1. Normalizes all word keys to uppercase.
2. Formats and validates the S3 URL to `https://signvision-085587597556.s3.ap-south-1.amazonaws.com/sigml-files/<word>.sigml`.
3. Verifies that the `.sigml` file exists locally in `data/Initial-sigml-files/`.
4. Writes the compiled JSON symmetrically to both `data/` and `Application/src/data/`.

---

*SignVision — Dataset & Linguistic Annotations Specification.*
