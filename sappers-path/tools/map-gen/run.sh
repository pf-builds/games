#!/bin/zsh
# One SDXL run (one image), then the memory check. Usage: ./run.sh base <sheet> <seed> [strength] | ./run.sh road <sheet> <seed> <base.png> [strength]
cd "${0:A:h}"
log=logs/$1-$(printf %02d $2)-s$3-$(date +%H%M%S).log
/Users/peter/local-ai/.venv/bin/python paint.py "$@" > $log 2>&1
echo "after: $(memory_pressure | tail -1) | swap $(sysctl -n vm.swapusage)" >> $log
grep -E "saved|after|Error" $log
