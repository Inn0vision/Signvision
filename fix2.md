# SIGNVISION — PHASE 2: PRODUCTION-READY HYBRID NLP ENGINE
## Groq + spaCy + ISL Grammar + Semantic Sign Grounding

### YOUR ROLE

Act as a senior NLP/ML architect and production Python backend engineer. You are continuing work on my existing SignVision project after Phase 1 has been completed.

Your task is to implement a carefully engineered hybrid NLP pipeline that improves sentence understanding, preserves meaning, reduces unnecessary Groq API calls, minimizes latency and token usage, and generates reliable ISL gloss sequences that work with the existing sign dictionary and 3D avatar pipeline.

This is Phase 2 of a three-stage project.

**Phase 1 repaired the foundation. Phase 2 implements the hybrid NLP pipeline. Phase 3 will perform final end-to-end integration verification and production-readiness checks.**

Do not restart the project. Do not replace working components simply because a different architecture sounds better. Inspect the current code, understand the Phase 1 modifications, and build on them.

You have permission to implement and install any additional dependency that is genuinely necessary, but reuse the existing `.venv` and minimize new dependencies.

---

# PART A — MANDATORY PRE-IMPLEMENTATION INSPECTION

Before changing any code:

1. Locate the repository root and inspect `git status` and the current diff. Preserve all user modifications and the completed Phase 1 work.

2. Verify that the existing `.venv` contains a working spaCy installation and the `en_core_web_sm` language model. Use the existing Python interpreter for all backend commands.

3. Read the current implementations of:
   - `backend/app/core/nlp_engine.py`
   - `backend/app/services/multilingual_service.py`
   - `backend/app/services/word_lookup.py`
   - `backend/app/services/semantic_search.py`
   - `backend/app/services/translation_cache.py`
   - `backend/app/core/config.py`
   - `backend/app/main.py`
   - Existing NLP, lookup, and API tests.
   - Relevant response models, dependencies, configuration and frontend API contracts.

4. Trace every actual Groq call, including multilingual translation, semantic extraction, fallback extraction, retries, and any duplicate or indirect calls.

5. Inspect the Phase 1 lookup changes. Confirm how exact matching, approved aliases, morphology, ChromaDB cosine similarity, threshold validation, missing-sign handling, and fingerspelling currently work.

6. Identify which functions and API routes are really active. Do not implement a second NLP engine that the running application never uses.

7. Research official spaCy and Groq documentation for the installed versions and selected model. Verify supported API parameters, structured-output capabilities, dependency parsing, model compatibility and rate-limit handling.

8. Before editing, establish a short implementation plan based on the actual repository. Resolve minor uncertainties through code inspection. Ask me only if an important architectural decision cannot be safely determined.

Do not modify the frontend, avatar renderer, AWS resources, sign assets, or unrelated services in this phase.

---

# PART B — THE TARGET ARCHITECTURE

Implement the following logical pipeline while preserving the existing application contracts.

USER INPUT
→ LANGUAGE DETECTION AND NORMALIZATION
→ SEMANTIC FRAME EXTRACTION
→ FRAME VALIDATION AND ROUTING
→ SEMANTIC CONCEPT-TO-SIGN RESOLUTION
→ ISL GLOSS GENERATION
→ FINAL SIGN-ASSET LOOKUP
→ EXISTING SiGML AND CWASA PIPELINE

Use Groq for multilingual normalization and difficult semantic interpretation. Use spaCy and local Python rules for the linguistic work they can reliably handle. Use the existing sign lexicon and ChromaDB as the source of truth for available sign concepts and semantic candidate retrieval.

These are distinct responsibilities. Do not mix them into one enormous function.

## 1. Language detection and normalization

SignVision must support user input in:

- English
- Hindi
- Marathi
- Common Romanized Hindi or Marathi, such as `kya aapne khana khaya?`

Inspect the current language-detection logic before replacing or extending it.

### English input

If the input is already English, do not call Groq merely to translate English into English.

Apply inexpensive local normalization first. Preserve the original meaning, punctuation information needed by the parser, negation, tense, question structure and clause boundaries.

### Hindi, Marathi and Romanized Indic input

Use Groq to convert the input into clear, simple English without losing its intended meaning.

The normalized English must retain important information, including:

- Subject and person.
- Verb and its meaning.
- Object and other participants.
- Negation.
- Tense, aspect and modality where relevant.
- Time and location expressions.
- Questions, WH-words and imperative intent.
- Modifiers, named entities and meaningful multiword expressions.

Do not simplify the sentence by silently deleting meaningful information.

Handle code-switching and Romanized input carefully. Do not use Devanagari-only detection as the sole test for whether an input requires multilingual processing.

If language identification is genuinely ambiguous, use a conservative fallback instead of confidently interpreting an Indic sentence as ordinary English.

### Reduce sequential Groq calls

Inspect whether the current application makes one Groq call for translation and another for semantic extraction.

For Indic inputs, investigate a single structured Groq request that returns both:
- Meaning-preserving normalized English.
- A structured semantic representation of that same input.

This is the preferred design if the selected model supports it and accuracy can be preserved.

Parse the normalized English with spaCy locally for linguistic analysis and validation. Do not make another Groq request merely because spaCy was run.

For straightforward English inputs, the normal path should use local processing without Groq. For difficult English inputs, use a single semantic-extraction request only when the local engine determines that it cannot safely process the construction.

For Indic input, the normal path should require one Groq request, with any additional request reserved for a specific, justified recovery case.

Do not combine unrelated operations into a larger prompt merely to reduce the number of calls. Measure correctness as well as latency and token usage.

---

# PART C — IMPLEMENT THE HYBRID NLP ENGINE

## 2. Make spaCy genuinely useful

The English language model is now available from Phase 1. Use it in the active NLP pipeline.

Use spaCy for the capabilities its installed model actually provides:

- Tokenization and sentence boundaries.
- Part-of-speech tagging.
- Lemmatization.
- Dependency parsing.
- Identification of grammatical relationships and relevant sentence components.

Parse each normalized sentence once and reuse the resulting `Doc`. Avoid running the full spaCy pipeline repeatedly for the same sentence in different helper functions.

Do not use regex as the primary way to determine every subject, object, verb and tense when the loaded spaCy annotations can supply useful grammatical information.

However, do not blindly trust the dependency parser. Its annotations are linguistic predictions, not guaranteed ground truth. Negation, contractions, coordinated clauses, questions and unusual constructions still need careful handling.

Check that required annotations are actually present before using them. Keep initialization separate from per-request processing.

If the model cannot load, log a clear diagnostic and use the established fallback behavior. Do not crash every request, repeatedly download the model, or silently claim full NLP functionality while operating in degraded mode.

## 3. Use deterministic rules where they are reliable

Develop or improve a compact, testable local extraction layer using spaCy annotations and custom Python rules.

It should handle common patterns involving:

- Subjects, pronouns, objects and verbs.
- Common verb inflections.
- Present, past and future time expressions.
- Negation and auxiliary constructions.
- Yes/no and WH questions.
- Adjectives and important adverbs.
- Common commands and short conversational phrases.
- Simple compound phrases and multiple clauses where supported.

Prefer rules based on linguistic relationships and reusable grammatical patterns instead of only exact-sentence templates.

For example, a supported rule should generalize across multiple sentences with the same construction rather than working only for one memorized phrase.

Do not create hundreds of brittle regex rules or attempt to build a complete English grammar from scratch.

If a construction is not covered reliably, route it to Groq rather than returning a plausible but incorrect semantic representation.

---

# PART D — CREATE A SHARED, VALIDATED SEMANTIC REPRESENTATION

## 4. Introduce a structured intermediate representation

Inspect the existing extraction object and extend it minimally into a validated representation shared by local rules and Groq.

Use an existing Pydantic or typed-data convention if suitable. Avoid creating unnecessary abstractions or duplicate schemas.

The representation should support the concepts genuinely needed by the existing gloss generator, including, where applicable:

- Subject.
- Predicate or normalized verb.
- Object and additional participants.
- Relevant adjectives and adverbs.
- Time and location expressions.
- Tense, aspect or modality.
- Negation.
- Question type and WH-word.
- Important phrases, entities or clause relationships.
- A traceable extraction method, such as local rule or Groq.
- An explicit state for unsupported or unresolved structures.

Do not add dozens of unused fields simply to make the schema look comprehensive.

Preserve the distinctions between a missing value, an unknown value and a genuinely absent participant. Do not fabricate objects or subjects when the input does not provide enough information.

Use the same semantic contract for local extraction and Groq extraction so the downstream pipeline does not need separate implementations for every source.

### Groq response requirements

The LLM must extract the intended meaning into the agreed representation. It must not directly produce arbitrary final gloss sequences or SiGML.

Inspect the currently configured model before selecting an output format.

- Use schema-constrained structured outputs if the selected model supports the required mode.
- Otherwise use the best compatible JSON mode and validate the result in application code.
- Validate types, permitted enum values, required fields, nullability and consistency.
- Reject malformed or semantically incomplete responses.
- Keep output token limits appropriate for the task.

Never assume that valid JSON means correct sentence understanding.

Do not switch models, rewrite API integration, or increase token budgets without evidence that the change improves the project.

Preserve the existing Groq key manager and key-rotation behavior. Do not expose API keys in logs or errors.

---

# PART E — INTELLIGENT ROUTING BETWEEN LOCAL NLP AND GROQ

## 5. Implement a transparent routing policy

Do not use a fabricated confidence percentage such as 98% simply because a model returns it.

Build routing from observable conditions: known rule coverage, required-field availability, parse annotations, structural consistency, and explicit detection of unsupported patterns.

The normal routing policy should be:

### Route A: Straightforward English

1. Normalize locally.
2. Parse with spaCy.
3. Apply a supported local extraction rule.
4. Validate the resulting semantic representation.
5. Continue without a Groq call.

### Route B: Complex or ambiguous English

1. Run local analysis first.
2. Detect that no safe supported extraction rule exists or that the required information is incomplete or contradictory.
3. Call Groq once to extract a structured representation.
4. Validate the response and use the shared downstream pipeline.

### Route C: Hindi, Marathi or Romanized Indic

1. Detect or classify the input appropriately.
2. Call Groq to produce normalized English and the structured semantic representation in one request, where supported.
3. Parse the normalized English with spaCy.
4. Use local linguistic information to validate and enrich the shared representation where safe.
5. Continue to the shared sign-resolution and gloss-generation stages.

If the normalized text and extracted semantic information materially disagree, do not silently choose a result. Use explicit reconciliation logic and a limited fallback when necessary.

### Route D: API failure or unavailable model

Preserve a clearly defined fallback.

A failed Groq call must not cause an unbounded retry loop. Use bounded retries and appropriate handling for temporary failures and rate limits.

For English, use local processing when it can still safely preserve meaning. For an Indic input that cannot be translated, never pretend that raw Indic tokens have been correctly interpreted as English. Follow the application's existing controlled failure or degraded-mode response.

All routes must use the same output contract.

---

# PART F — SEMANTIC GROUNDING IN THE AVAILABLE ISL SIGN INVENTORY

## 6. Never let the LLM invent the final available sign sequence

SignVision has an existing inventory of approximately 1,149 dictionary records, approximately 1,142 records with valid URLs according to the Phase 1 report, and a persistent ChromaDB index built from playable canonical signs and approved aliases.

Inspect the live implementation and use its actual current counts and interfaces rather than hardcoding these numbers.

The application must preserve the meaning of the sentence while ensuring that generated lexical concepts can be mapped to available signs where possible.

**Do not send the entire 1,142-sign inventory to Groq for every request.** That would waste tokens, increase latency and make the prompt unnecessarily large.

Do not ask Groq to arbitrarily rewrite sentences until all words resemble available dictionary entries.

Instead, use the validated semantic representation to identify the intended lexical concepts, then resolve those concepts against the existing inventory before final gloss ordering, using the existing Phase 1 resolver wherever possible.

The lookup hierarchy should use:

1. Exact canonical signs.
2. Approved aliases.
3. Safe morphological normalization.
4. ChromaDB semantic candidate retrieval when the previous methods fail.
5. An existing safe fallback, such as fingerspelling, when no acceptable sign can be selected.

Do not rebuild the index or arbitrarily change its similarity threshold in Phase 2.

### Correct placement of semantic retrieval

ChromaDB is a sign-lexicon grounding component, not a general-purpose English sentence parser.

Use it only for meaningful lexical concepts that need sign resolution. Do not pass punctuation, arbitrary fragments, synthetic question markers or raw grammar instructions through semantic search indiscriminately.

If moving concept resolution ahead of gloss ordering requires changes to the existing lookup interface, make the smallest safe refactor possible. Avoid running the same vector search twice for the same concept.

Preserve valid multiword signs and existing phrase mappings.

Do not replace one semantically important concept with an unrelated available sign just because the latter has a high similarity score. A semantic score is a candidate-selection signal, not proof of equivalence.

If the system cannot determine an acceptable equivalent, preserve the intended concept and follow the established unresolved-word/fingerspelling behavior.

Keep the final asset lookup authoritative: every sign reported as playable must still map to a usable asset through the existing backend and frontend.

---

# PART G — ISL GLOSS GENERATION

## 7. Separate sentence understanding from gloss ordering

Keep the gloss-generation rules separate from language detection, Groq, spaCy and ChromaDB.

Use the validated semantic representation to generate the ordered gloss sequence using the existing ISL-specific rules.

Review the current implementation in `nlp_engine.py`, including `preprocess_text()`, `analyze_text()`, `apply_isl_rules()`, `build_gloss_output()`, and the actual active extraction functions.

Refactor only where necessary to eliminate brittle behavior, duplicated processing, unsupported assumptions, or incorrect information flow.

Important requirements:

- Preserve negation.
- Preserve meaningful time expressions.
- Preserve the intended subject, object and action.
- Handle question types and WH-words deliberately.
- Preserve relevant modifiers and clauses when supported.
- Avoid adding duplicate question or negation markers.
- Handle contraction expansion without altering intended meaning.
- Avoid dropping important words simply because they are difficult to map to an available sign.
- Prevent multiple sentences from being merged into a grammatically incoherent gloss sequence.

Treat the existing rule order as a starting implementation, not proof that one fixed order covers every ISL construction.

Do not claim that English dependency labels automatically determine correct ISL grammar. The rules must be explicit, isolated and testable, with limitations acknowledged where expert-reviewed ISL examples are unavailable.

Do not attempt to rewrite the entire ISL grammar from linguistic theory alone. Preserve useful existing behaviors and introduce changes incrementally.

---

# PART H — LATENCY, COST, CACHING AND OBSERVABILITY

## 8. Reduce unnecessary work

Inspect the existing cache and request-deduplication infrastructure from Phase 1.

Reuse it. Do not create Redis infrastructure, a second cache or another model server unnecessarily.

Cache eligible normalized text, structured extraction results or translation results where appropriate. Cache keys must distinguish relevant inputs such as source language, normalized source text, selected model and pipeline/schema version.

Do not cache failed responses, transient API errors or results across incompatible pipeline versions.

Do not let a cache entry produced by an old NLP schema silently bypass newly required validation.

Ensure concurrent requests for identical inputs reuse in-flight work when the existing infrastructure supports it.

## 9. Add useful diagnostic metrics

Use the project's existing logging conventions to record useful stage timings and routing information, such as:

- Language-detection duration.
- Groq request count and duration.
- spaCy analysis duration.
- Local-rule versus Groq-fallback routing.
- Semantic-frame validation failures.
- Cache hits and misses.
- Sign-resolution duration and unresolved concepts.

Avoid printing full user utterances, personal data, API keys, or secret configuration.

Do not add a large observability platform. Lightweight structured logs are sufficient for this phase.

The objective is to be able to determine whether latency is caused by Groq, local NLP, sign resolution, asset fetching or another stage without guessing.

---

# PART I — REQUIRED FOCUSED TESTS

## 10. Test the new NLP path without exhausting the APIs

Create or update a small set of targeted tests for the actual hybrid engine.

Do not run the entire application test suite or make dozens of real Groq calls.

Use mocks for the Groq client in automated tests, including mocked valid responses, malformed structured responses, timeouts and API failures.

Test at least these scenarios:

1. A straightforward English affirmative sentence takes the local path when a supported rule covers it.
2. A straightforward English negative sentence preserves negation.
3. A yes/no question preserves question type and verb meaning.
4. A sentence containing a time expression preserves the time and action.
5. A common past-tense sentence extracts the correct verb lemma and tense evidence.
6. A supported sentence with an object preserves that object.
7. A complex or unsupported English construction uses the Groq fallback rather than returning an unjustified local result.
8. Hindi input produces normalized English and a validated semantic frame.
9. Marathi input produces normalized English and a validated semantic frame.
10. A Romanized Hindi/Marathi example is not silently mishandled as ordinary English.
11. An English request does not make a redundant multilingual translation call.
12. A normal Indic request uses one Groq request when the combined structured response succeeds.
13. Malformed Groq output is rejected or handled safely.
14. A Groq timeout or rate-limit failure follows the defined fallback policy.
15. The semantic representation flows through the existing lexicon resolver and gloss generator correctly.
16. A missing sign does not cause arbitrary semantic substitution.
17. The existing API response remains compatible with the frontend.

Use existing project conventions. Add only the tests necessary to exercise these paths.

Expected semantic-frame outputs should be deterministic and reviewed. Do not pretend to prove full ISL linguistic accuracy from a few examples.

Use the current project dictionary and actual available signs. Do not invent sign entries to make a test pass.

### Groq call-count verification

Instrument or mock the client so the tests can actually verify the intended routing.

At minimum verify:

- Covered English fast path: zero Groq requests.
- Difficult English fallback: one semantic-extraction request.
- Supported Indic path: one normalization-plus-extraction request.
- Additional calls occur only when a defined recovery branch requires them.

If a real API smoke test is practical and the existing credentials are already configured, use at most one or two representative requests. Never print the credentials. Do not make real API usage the prerequisite for passing automated unit tests.

---

# PART J — PROTECT THE EXISTING APPLICATION

## 11. Backward compatibility is mandatory

Keep the existing API endpoints, request fields, response fields and error-handling conventions compatible with the frontend.

Do not alter `HomeScreen.tsx`, `AvatarWebView.tsx`, `sigmlCompiler.ts`, or the animation transport unless inspection proves a minimal compatibility change is unavoidable. Such a change must be explained before implementation.

Preserve:

- The current sign dictionary.
- Phase 1 ChromaDB persistence and configuration.
- Canonical sign names and approved aliases.
- SiGML URLs and asset data.
- Fingerspelling behavior.
- `ProcessResponse` or its actual equivalent.
- Existing Groq key handling.
- Existing caching and request deduplication.

Never regenerate or overwrite the sign inventory as a side effect of NLP processing.

Do not add a new large model, alternate translation backend or complex rule engine without a demonstrated need.

---

# PART K — EXECUTION AND ACCEPTANCE CRITERIA

## 12. Work in controlled steps

Perform the work in this order:

1. Inspect the live Phase 1 code and establish the current behavior.
2. Map the current Groq calls and identify redundant sequential calls.
3. Define the minimal shared semantic representation.
4. Implement the local spaCy extraction path for supported patterns.
5. Implement the conditional Groq fallback for unsupported English input.
6. Combine Indic normalization and semantic extraction into a single structured Groq request wherever the selected model and output schema support it.
7. Validate and reconcile local and LLM representations.
8. Integrate meaning-preserving sign grounding with the existing Phase 1 resolver.
9. Ensure the ISL gloss generator consumes the validated representation.
10. Integrate with the current endpoint without breaking the frontend.
11. Run the focused tests and resolve failures.
12. Inspect the final diff and produce a concise report.

After each stage, review the changed code and perform its relevant focused checks before moving on. Do not perform a massive rewrite in one edit.

### Definition of done

Phase 2 is complete when:

- English inputs can use a genuinely local NLP path when the construction is supported.
- spaCy is actually used in the active request pipeline.
- Hindi, Marathi and supported Romanized input retain the existing translation capability.
- Successful multilingual normalization and semantic extraction can share a single Groq request.
- Complex English inputs can use Groq as a controlled fallback.
- Every path produces a validated shared semantic representation.
- ChromaDB is used for sign-lexicon grounding rather than general sentence parsing.
- The pipeline does not ask Groq to invent the final gloss sequence or arbitrary sign substitutions.
- The existing ISL grammar logic consumes the semantic representation without losing essential meaning.
- Repeated unnecessary API calls are removed where the new behavior proves reliable.
- The current cache, API response and animation integration remain compatible.
- Focused tests and direct smoke checks have actually been executed.
- Actual call counts, unresolved limitations and failures are reported truthfully.

## 13. FINAL ENGINEERING REPORT

When finished, tell me:

1. What the original NLP request path actually did.
2. What the new hybrid request path does.
3. Which functions and files changed.
4. Exactly when Groq is called and when it is not.
5. How multilingual translation and extraction share a request.
6. How spaCy annotations are used and where local rules apply.
7. How the semantic representation is validated.
8. Where sign grounding occurs and how it uses Phase 1 functionality.
9. What caching and latency instrumentation is available.
10. Which focused tests were executed, including observed Groq call counts.
11. Any cases that remain inaccurate, ambiguous or unsupported.
12. The precise next steps for Phase 3.

Use actual file paths, function names and relevant line references. Distinguish measured performance from expected improvements. Do not report unmeasured latency or accuracy gains as established facts.

**STOP after Phase 2. Do not begin Phase 3, perform a comprehensive performance campaign, or make unrelated frontend or deployment changes. Wait for my review of the report and the next prompt.**