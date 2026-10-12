# SignVision — Data Layer & Sign Dictionary Specification (`data_info.md`)

> **Master specification of the SignVision sign dictionary schema, offline SiGML gesture descriptions, and AWS S3 asset delivery.**

---

## ⚡ 1. Brief Data Summary (TL;DR)

The `data/` directory houses the primary sign dictionary mapping English vocabulary to 3D SiGML XML motion files:

### Quick Metrics
- **Master Dictionary**: `data/sign_language_data.json` (mirrored in `Application/src/data/sign_language_data.json`)
- **Total Signs**: 1,500+ vocabulary entries
- **Asset Storage**: AWS S3 (`ap-south-1`) hosting 1,500+ `.sigml` motion assets
- **Offline Files**: `data/Initial-sigml-files/` contains raw XML SiGML files used for local offline backups and cloud synchronization.

---

## 🛠️ 2. Detailed Technical Specification

### 2.1 Sign Record Schema (`sign_language_data.json`)

Each entry in `sign_language_data.json` maps an uppercase English GLOSS token to its metadata and cloud asset URL:

```json
{
  "SCHOOL": {
    "url": "https://signvision-085587597556.s3.ap-south-1.amazonaws.com/sigml-files/school.sigml",
    "category": "education",
    "anchors": ["COLLEGE", "STUDY", "CLASSROOM"],
    "hamnosys": "hamfinger2 hamthumbacross ..."
  },
  "AIRPLANE": {
    "url": "https://signvision-085587597556.s3.ap-south-1.amazonaws.com/sigml-files/airplane.sigml",
    "category": "transport",
    "anchors": ["AEROPLANE", "FLIGHT", "PLANE"],
    "hamnosys": "..."
  }
}
```

#### Field Definitions
- **Key** (`string`): The standardized uppercase GLOSS token.
- **`url`** (`string`): Verified HTTPS URL pointing to the `.sigml` XML file on AWS S3 in `ap-south-1`.
- **`category`** (`string`, optional): Semantic grouping (e.g., `greetings`, `education`, `time`, `food`, `emotions`).
- **`anchors`** (`string[]`, optional): Array of synonyms, British/American English variants, or semantically adjacent terms used by Tier 2 word lookup.
- **`hamnosys`** (`string`, optional): Hamburg Notation System string encoding phonetic handshape, orientation, and motion primitives.

---

### 2.2 Golden Rule: Dataset Symmetry

> [!CRITICAL]
> Any modification, addition, or deletion made to `data/sign_language_data.json` MUST be mirrored identically in `Application/src/data/sign_language_data.json`.
> Failing to maintain symmetry causes discrepancies between mobile offline word lookup and backend sentence translation.

---

### 2.3 SiGML XML Gesture Architecture

SiGML (Signing Gesture Markup Language) is an XML-based specification used by the CWASA WebGL avatar engine to drive 3D skeletal bones.

#### Structure of a `.sigml` file:
```xml
<sigml>
  <hns_sign gloss="SCHOOL">
    <nonmanual>
      <mouthing_tier>
        <mouth_gesture movement="L04"/>
      </mouthing_tier>
    </nonmanual>
    <manual>
      <handconfig handshape="flat" thumbshape="out"/>
      <handconfig extfidir="o" palmor="d"/>
      <rpt_motion repetition="fromstart">
        <circular_motion axis="l" clock="true" size="small"/>
      </rpt_motion>
    </manual>
  </hns_sign>
</sigml>
```
- `<manual>`: Governs handshape configuration, finger flexion, thumb opposition, palm orientation, and spatial motion paths.
- `<nonmanual>`: Governs facial expressions, head tilts, and mouth shapes.

---

### 2.4 Cloud Asset Provisioning & S3 Synchronization

The cloud assets are hosted on an S3 bucket configured for public read access and cross-origin resource sharing:

- **Bucket**: `signvision-085587597556`
- **Region**: `ap-south-1` (Mumbai)
- **CORS XML Policy**:
  ```xml
  <CORSConfiguration>
    <CORSRule>
      <AllowedOrigin>*</AllowedOrigin>
      <AllowedMethod>GET</AllowedMethod>
      <AllowedMethod>HEAD</AllowedMethod>
      <AllowedHeader>*</AllowedHeader>
      <MaxAgeSeconds>3000</MaxAgeSeconds>
    </CORSRule>
  </CORSConfiguration>
  ```
- **Syncing Offline Files to S3**:
  ```bash
  aws s3 sync data/Initial-sigml-files/ s3://signvision-085587597556/sigml-files/ --acl public-read
  ```

---

*SignVision — Data Layer & Sign Dictionary Specification.*
