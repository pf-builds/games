#!/bin/zsh
# Runs ./run.sh once per line of a job file, strictly one after another (one image per run, never in parallel).
cd "${0:A:h}"
while read -r line; do [[ -z $line || $line == \#* ]] && continue; echo "== $line"; ./run.sh ${=line}; done < $1
echo BATCH_DONE
