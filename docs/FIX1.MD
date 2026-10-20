# SIGNVISION — PHASE 1: FOUNDATION, SPACY, CHROMADB AND SIGN-LOOKUP REPAIR

## YOUR ROLE

Act as a senior Python backend engineer, NLP/ML engineer, vector-search engineer, and production application architect.

You are working on my existing SignVision project. Your task is to repair the foundation of the existing application carefully so we can subsequently build a reliable, fast hybrid NLP pipeline.

Do not behave like a code generator that blindly rewrites files. First understand the actual execution paths, identify the real problems, implement targeted fixes, and verify them.

I use Antigravity as my coding environment. The project already has a Python virtual environment named `.venv`. Reuse it.

**This is PHASE 1 OF 3. Complete this phase and report the results. Do not begin the full hybrid NLP redesign; that belongs to Phase 2.**

---

## 1. NON-NEGOTIABLE ENGINEERING RULES

1. Inspect actual source code, imported modules, runtime configuration, dependency manifests, data files, and real SiGML assets. Do not treat README files, Markdown explanations, or old reports as proof of how the application works.

2. Discover the actual repository root and active backend. Do not assume that the current working directory is the project root or that a particular copy of the dictionary is the source of truth.

3. Before modifying anything, inspect Git status and existing changes. Preserve unrelated user modifications. Never discard changes, reset branches, delete project files, or perform a destructive Git operation.

4. Use the existing `.venv` for Python commands and package installations. Verify the actual interpreter and pip paths before installing anything. Do not install backend dependencies into system Python.

5. Research relevant technical uncertainties using web search and authoritative documentation, especially official spaCy and ChromaDB documentation. Match recommendations to the versions actually installed. Include useful source links in your final report.

6. Work sequentially. Complete one stage, inspect the files changed, run the relevant focused checks, resolve failures, and only then continue. Do not conceal failures or assume that successful package installation means successful integration.

7. Do not change AWS resources, EC2 infrastructure, S3 bucket configuration, external deployments, DNS, or unrelated frontend components. Do not upload, delete, or reorganize hosted assets.

8. Do not expose API keys, environment secrets, credentials, or `.env` contents in logs or reports. Preserve the existing environment configuration.

9. Keep changes small, understandable, reproducible, and reversible. Avoid adding unnecessary libraries or downloading large models without a clear need.

10. Do not run the entire test suite, benchmark the whole system, or perform exhaustive network checks in this phase. Run focused checks for the components being repaired.

11. If a genuinely consequential ambiguity cannot be resolved through source-code inspection or authoritative documentation, ask me one concise question before making an irreversible or architecturally significant decision. Do not interrupt for minor details that can be established from the code.

12. If a dependency is incompatible with the existing Python version, investigate the supported compatibility options before changing interpreters or recreating the virtual environment. Do not destroy the existing environment to work around an unexplained error.

## 2. FIRST: DISCOVER THE REAL PROJECT STRUCTURE

Start by locating the repository root, the active FastAPI backend, its entry point, and the modules responsible for:

- NLP and language processing.
- Multilingual input normalization and translation.
- The sign dictionary and word lookup.
- ChromaDB initialization, embeddings, indexing, and retrieval.
- Environment and configuration handling.
- API response models and endpoints.
- Sign inventory files and SiGML assets.
- Frontend sign playback interfaces, where needed to verify compatibility.
- Existing caches, model-loading code, and fallback mechanisms.

Read the actual implementation of the relevant functions and trace their callers. Search for duplicate implementations and multiple dictionary copies.

Determine which code is used by the running backend and which files are unused, obsolete, or imported only by scripts.

Do not modify the frontend or NLP architecture during this discovery stage.

## 3. SECOND: ACTIVATE AND VERIFY THE EXISTING .venv

Locate the existing `.venv` and activate it using the appropriate shell command, or invoke its interpreter directly.

Verify and report:

- Python version and executable path.
- pip executable path.
- spaCy version.
- Whether `en_core_web_sm` is installed and loads successfully.
- ChromaDB version.
- Sentence-Transformers version, if used.
- Groq SDK version.
- Other dependencies directly required by the active backend.

Run all package commands through the existing virtual environment.

Inspect every applicable dependency manifest, especially the root `requirements.txt` and backend dependency file. Determine which manifest is actually used to install and deploy the backend.

### Repair spaCy model loading

The previous audit reported that spaCy was installed but `en_core_web_sm` could not be loaded. Verify whether this is still true.

If the model is missing:

1. Check compatibility between the current Python interpreter, installed spaCy version, and the language model.
2. Research the supported installation method for the compatible model.
3. Install it into the existing `.venv`.
4. Run a real parsing example and inspect tokens, lemmas, POS tags, and dependency relationships.
5. Inspect the existing NLP loader to confirm that it actually uses the model rather than silently falling back to the regex tagger.

Do not merely install spaCy and declare the problem fixed.

Make the required dependency manifests reproducible. Ensure that deploying the backend installs both spaCy and the appropriate language model through an explicit, version-compatible mechanism. If model installation requires a separate step, document or automate that step in the relevant installation process.

Do not perform model downloads during every API request or silently download models on application startup.

Preserve a safe fallback if the model genuinely cannot load, but make the degraded state visible in health checks or diagnostic logging.

Do not redesign the full NLP pipeline in this phase.

## 4. THIRD: AUDIT THE REAL SIGN INVENTORY

My project contains approximately 1,119 signs, and existing audit results have reported different counts. Verify the current assets and implementation yourself.

Inspect the actual dictionary loaded by the backend, the local SiGML directory, the configured S3 URL mappings, approved aliases, and the real lookup implementation.

Determine the following separately:

- Total dictionary records.
- Unique canonical sign names after normalization.
- Records with nonempty sign URLs.
- Records with structurally valid URLs.
- Records with missing URLs or other required mapping fields.
- Local SiGML file count.
- Dictionary entries that correspond to identifiable local assets.
- Duplicate or conflicting canonical names.
- Duplicate URLs and aliases that point to multiple different signs.
- Entries with mappings that cannot currently produce an animation through the existing frontend.

Do not assume that the local `.sigml` file count equals the number of playable dictionary signs. Do not assume that a nonempty URL guarantees that an asset is available.

Use the actual backend source of truth. Do not silently reconcile multiple dictionary copies by overwriting them.

Produce a concise inventory report based on verified counts. Where live S3 availability cannot reasonably be verified, label the result as unverified instead of claiming the URL works.

Do not upload, delete, rename, or regenerate the sign assets.

## 5. FOURTH: REPAIR CHROMADB PERSISTENCE AND SEMANTIC SEARCH

Inspect the real `semantic_search.py`, `word_lookup.py`, configuration, embedding model, and every call site.

The previous audit indicated that the ChromaDB directory was missing, so the application fell back to character-based Dice similarity. Verify whether this is still the runtime behavior.

Determine:

- The actual persistent database path.
- Whether the path changes depending on the process working directory.
- The intended collection name.
- The embedding model used for both indexing and queries.
- Whether indexing has ever been performed.
- How existing collections are created, loaded, and validated.
- What happens when the collection is missing or the embedding model fails to load.
- Which similarity metric is configured.
- Whether the existing implementation confuses cosine distance with cosine similarity.

### Build a reproducible sign index

Once the dictionary audit is complete, repair the indexing process so it can create and reopen the actual persistent ChromaDB index.

Requirements:

1. Index only sign concepts that have a usable mapping to an animation asset through the existing application. Do not make an unavailable sign appear playable simply by inserting it into the index.
2. Use canonical sign names and only legitimate, existing, or explicitly approved aliases. Inspect available metadata before deciding what text to embed.
3. Include appropriate descriptive context from the real dictionary when available. Do not invent gloss meanings, synonyms, or definitions.
4. Use one consistent embedding model and preprocessing strategy for both stored documents and query embeddings.
5. Configure cosine distance using the API supported by the installed ChromaDB version. Research the current configuration API rather than copying outdated examples.
6. Use a stable persistent path resolved independently of the shell's current directory, while preserving the project's existing configuration conventions.
7. Make indexing reproducible and idempotent. Rebuilding the index must not duplicate records or silently retain obsolete entries.
8. Store enough metadata to identify the canonical sign key, approved aliases, and associated playable asset.
9. Detect incompatible, stale, or incomplete collections. Provide an explicit, safe rebuild procedure rather than silently pretending that vector search works.
10. Do not embed the entire dictionary on every request or download the embedding model on every query.

Verify collection count, sample retrievals, persistence after closing and reopening the client, and the configured distance metric.

For cosine-based retrieval, explicitly verify how ChromaDB's returned distance is converted into the application's similarity score. Do not assume that a smaller distance is a larger distance-derived error-free match score without checking the documented semantics.

Do not treat a technically successful vector query as evidence that semantic matching is accurate. Inspect actual results.

## 6. FIFTH: FIX THE WORD-LOOKUP ORDER AND FALSE POSITIVES

Inspect the actual lookup logic and API response model before changing it.

The previous audit reported that broad substring matching ran before semantic retrieval. Examples included CARPET matching CAR and CARE matching ARE. Verify the current bug and fix it if it exists.

Implement or preserve an explicit, safe lookup hierarchy:

**A. Exact canonical match**

Normalize case, whitespace, Unicode, and punctuation consistently without damaging legitimate multiword sign names.

**B. Approved alias match**

Resolve synonyms and aliases that are explicitly represented in the dictionary or a reviewed alias mapping. Resolve ambiguity when multiple signs claim the same alias.

**C. Morphological normalization**

Where useful, normalize inflection to a valid base form. Use spaCy's verified linguistic annotations where appropriate; otherwise use conservative, tested normalization.

Do not use arbitrary substring containment as equivalent to a word match.

**D. Semantic candidate retrieval**

Only after deterministic lookups fail, query the persistent ChromaDB index for candidate signs.

Rank candidates using the verified vector similarity implementation. Respect a conservative acceptance threshold and handle ambiguous or low-confidence candidates explicitly.

Do not automatically select the top candidate simply because it is the nearest available result. A nearest match can still have the wrong meaning.

Use the existing similarity configuration as an initial reference, but inspect and justify the acceptance threshold. Do not claim a threshold is calibrated if it has not been evaluated against labeled examples.

If the code cannot confidently establish a suitable sign, continue to the established fallback instead of silently substituting an unrelated concept.

**E. Safe final fallback**

Preserve and verify the existing fingerspelling mechanism. Confirm that individual letter and digit mappings resolve to usable assets.

Preserve support for multiword expressions and legitimate compound signs. Do not break phrases simply to simplify word matching.

Semantic retrieval should serve as a lexicon-resolution component. It must not become a replacement for NLP parsing or the future ISL grammar engine.

### Important distinction

A lexical synonym is not necessarily a valid substitution in every sentence. Do not rewrite the user's original sentence just to force every English word to be present in the sign dictionary.

Do not change the existing API response format in a way that breaks the frontend. Preserve required fields and add any useful lookup diagnostics only in a backward-compatible way.

## 7. SIXTH: VERIFY THE SIGN-LOOKUP BEHAVIOR

Create or update a small, focused set of regression checks for the lookup component. Reuse the project's testing conventions.

At minimum, inspect and verify these scenarios:

1. An existing canonical sign such as NICE resolves to its actual dictionary entry.
2. An explicitly approved synonym resolves to its intended canonical sign.
3. An absent word that has an appropriate semantic candidate can produce that candidate only when the score and contextual checks justify it.
4. CARPET must not map to CAR merely because of a shared substring.
5. CAT must not map to CATCH-2 merely because of a shared substring.
6. CARE must not map to ARE through substring matching.
7. An unrelated word with no acceptable semantic candidate does not receive a random sign.
8. An entry without a usable asset URL is not treated as a successfully playable animation.
9. The fingerspelling fallback resolves through the existing letter assets when applicable.
10. The lookup service behaves safely when ChromaDB is unavailable instead of silently claiming a semantic match.

Use actual dictionary data. Adjust expected canonical matches to the verified inventory instead of inventing new signs or assuming that a sample key exists.

Keep this focused. Do not attempt exhaustive semantic evaluation of the entire vocabulary during this phase.

## 8. SEVENTH: VERIFY INTEGRATION COMPATIBILITY

Verify that the repaired backend still returns the response contract expected by the frontend.

Inspect the existing callers and confirm that the changes do not break:

- Sign words and their canonical mappings.
- Asset URL fields.
- Existing match or found-status fields.
- The frontend's missing-sign handling.
- SiGML downloads and compilation.
- The WebView message structure and CWASA playback interface.

Do not rewrite the avatar, change the frontend transport, or change the overall pipeline in this phase.

Perform only the small integration smoke checks necessary to establish that the repaired lookup can feed the existing code path. Full end-to-end validation belongs to Phase 3.

## 9. EIGHTH: FINAL FOCUSED SMOKE CHECKS

Run the smallest useful checks that prove the changed components are operational:

- The active virtual environment loads the required spaCy pipeline.
- The configured ChromaDB index opens and contains the expected eligible records.
- A few exact and approved-alias lookups work.
- Semantic fallback produces inspectable candidate results.
- False-positive substring matches no longer occur.
- An unacceptable candidate falls through safely.
- The existing lookup response remains compatible with the frontend.
- The backend's directly affected modules import successfully.

If a check fails, investigate and fix the cause before moving forward. Do not report success from an unexecuted test or from a mocked result presented as real integration.

Do not run an exhaustive test suite or full application performance test.

## 10. ACCEPTANCE CRITERIA

Phase 1 is complete only when:

- The existing `.venv` is the verified environment used for the changes.
- The spaCy model installation and loading path are understood and working, or any genuine compatibility blocker is explicitly documented.
- The active dependency manifests describe a reproducible environment.
- The real sign inventory has been counted and its discrepancies explained.
- ChromaDB uses a persistent index, the correct embedding model, and the intended cosine-distance configuration.
- The index can be reopened without silently degrading to character-based similarity.
- Unsafe substring matching is removed or constrained so it cannot select unrelated signs.
- Approved aliases and the conservative semantic fallback work with actual dictionary records.
- Missing assets and no-match cases are handled honestly and safely.
- The frontend API contract and existing animation pipeline remain intact.
- The focused checks have actually been run, with failures reported accurately.

If an acceptance criterion cannot be met, explain the precise blocker and its impact. Do not fabricate a passing result.

## 11. FINAL REPORT TO ME

At the end, provide a concise engineering report containing:

1. What was wrong in the original implementation.
2. What you verified directly from source code and runtime.
3. Which files you changed and why.
4. Which packages or language models you installed into `.venv`.
5. The verified dictionary, URL, local asset, and ChromaDB index counts.
6. How the lookup order works after the repair.
7. The actual smoke checks performed and their results.
8. Any unresolved issues or assumptions.
9. Relevant official documentation consulted.
10. The exact next step needed for Phase 2.

Distinguish verified results from unverified assumptions. Report any dependency or data changes that could affect deployment.

**STOP after Phase 1. Do not start Phase 2, rewrite the NLP engine, or perform additional refactors until I review your report and provide the next prompt.**