#!/bin/bash
# mkgif.sh in.webm out.gif start dur speed width fps [crop]
in=$1; out=$2; ss=$3; t=$4; sp=$5; w=$6; fps=$7; crop=${8:+$8,}
f="${crop}setpts=PTS/$sp,fps=$fps,scale=$w:-1:flags=lanczos"
ffmpeg -v error -y -ss $ss -t $t -i $in -vf "$f,split[a][b];[a]palettegen=max_colors=${COLORS:-128}:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle" -loop 0 $out
echo "$out $(du -h $out|cut -f1)"
