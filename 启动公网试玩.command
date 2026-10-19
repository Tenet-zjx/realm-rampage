#!/bin/zsh
set -e
cd "${0:A:h}"
./scripts/public-preview.sh start
open 'https://wildwoodguardiansgame.cpolar.cn/'
