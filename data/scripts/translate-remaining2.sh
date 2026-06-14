#!/bin/bash
cd /Users/yona/Projects/schwurbel-website

SLUGS=(kupfer l-carnitin l-citrullin l-tryptophan l-tyrosin lithium-orotat lutein-zeaxanthin luteolin maca mangan molybdaen msm phosphatidylserin phosphor piperin pqq pterostilben reishi rutin same schisandra selen shilajit silicium silymarin tmg tongkat-ali trehalose urolithin-a vitamin-a vitamin-b1 vitamin-b2 vitamin-b3 vitamin-b5 vitamin-b6 vitamin-b7 vitamin-e vitamin-k1 vitamin-k2)

SUCCESS=0; FAIL=0
for slug in "${SLUGS[@]}"; do
  if ! grep -q "NEEDS_EN" "data/sources/ingredients/${slug}.yaml" 2>/dev/null; then
    echo "⏭️  $slug"
    continue
  fi
  echo -n "📝 $slug... "
  claude --model haiku --permission-mode bypassPermissions --print \
    "Read data/sources/ingredients/${slug}.yaml and replace all NEEDS_EN_TRANSLATION and NEEDS_EN_BODY with English translations of the DE content. Summary max 200 chars. Body 900+ words. ONLY edit this file." > /dev/null 2>&1
  if grep -q "NEEDS_EN" "data/sources/ingredients/${slug}.yaml"; then
    echo "⚠️"; FAIL=$((FAIL+1))
  else
    echo "✅"; SUCCESS=$((SUCCESS+1))
  fi
done
echo ""; echo "Done: $SUCCESS ✅ | Failed: $FAIL ⚠️"
