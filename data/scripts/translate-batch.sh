#!/bin/bash
# Batch-translate all YAML ingredients with NEEDS_EN using Claude Haiku
# Cost estimate: ~$1-2 for all 78 remaining files
#
# Usage: ./data/scripts/translate-batch.sh [slug1 slug2 ...]
# No args = process all files with NEEDS_EN

set -e
cd "$(dirname "$0")/../.."

SOURCES_DIR="data/sources/ingredients"
MODEL="haiku"
SUCCESS=0
FAIL=0
SKIP=0

# Get list of files to process
if [ $# -gt 0 ]; then
  SLUGS="$@"
else
  SLUGS=$(grep -rl "NEEDS_EN" "$SOURCES_DIR"/*.yaml 2>/dev/null | sed 's|.*/||;s|\.yaml||' | sort)
fi

TOTAL=$(echo "$SLUGS" | wc -w | tr -d ' ')
echo "🔄 Translating $TOTAL ingredients (model: $MODEL)"
echo ""

for slug in $SLUGS; do
  YAML="$SOURCES_DIR/$slug.yaml"
  
  if [ ! -f "$YAML" ]; then
    echo "❌ $slug — file not found"
    FAIL=$((FAIL + 1))
    continue
  fi
  
  NEEDS=$(grep -c "NEEDS_EN" "$YAML" 2>/dev/null || echo "0")
  if [ "$NEEDS" = "0" ]; then
    echo "⏭️  $slug — already complete"
    SKIP=$((SKIP + 1))
    continue
  fi
  
  echo -n "📝 $slug ($NEEDS fields)... "
  
  # Run claude with haiku model
  OUTPUT=$(claude --model "$MODEL" --permission-mode bypassPermissions --print \
    "Read $YAML. Replace ALL NEEDS_EN_TRANSLATION and NEEDS_EN_BODY placeholders with proper English content.

Rules:
- efsa_notes.en: translate the DE efsa_notes accurately
- key_studies findings.en: translate each DE finding preserving numbers, PMIDs, study details
- locales.en.summary: translate DE summary (MUST be max 200 characters)
- locales.en.evidenceSummary: translate DE evidenceSummary (2-4 sentences)
- locales.en.body: translate and adapt the DE body to English. Keep all concrete numbers, study references, section structure. Scientific, honest tone. 900+ words.
- Fix any 'war mit Veränderungen verbunden' or 'war mit höheren Werten verbunden' artifacts in DE text (replace with proper German: 'verbesserte', 'erhöhte', 'steigerte', etc.)
- Do NOT change anything else in the file.
- ONLY edit $YAML" 2>&1)
  
  # Check if successful
  REMAINING=$(grep -c "NEEDS_EN" "$YAML" 2>/dev/null || echo "0")
  if [ "$REMAINING" = "0" ]; then
    echo "✅ done"
    SUCCESS=$((SUCCESS + 1))
  else
    echo "⚠️  $REMAINING fields remaining"
    FAIL=$((FAIL + 1))
  fi
  
  # Small delay to avoid rate limits
  sleep 2
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Success: $SUCCESS"
echo "⚠️  Partial/Failed: $FAIL"
echo "⏭️  Skipped: $SKIP"
echo "Total: $TOTAL"
echo ""

if [ "$SUCCESS" -gt 0 ]; then
  echo "Next steps:"
  echo "  1. Review changes: git diff data/sources/ingredients/"
  echo "  2. Generate MDX:   for s in \$(git diff --name-only data/sources/ingredients/ | sed 's|.*/||;s|\.yaml||'); do npx tsx data/scripts/generate-from-source.ts \$s; done"
  echo "  3. Build:          npm run build"
  echo "  4. Commit:         git add -A && git commit -m 'feat: batch EN translations' && git push"
fi
