#!/usr/bin/env python3
"""Register a pack of generated images: --map safe_id:image_path ..."""
from __future__ import annotations
import argparse, subprocess, sys, tempfile
from pathlib import Path

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--map', nargs='+', required=True, help='safe_id:/path/to.jpg')
    ap.add_argument('--note', default='wave batch accept')
    args=ap.parse_args()
    script=Path(__file__).with_name('register_authority_infograph.py')
    with tempfile.TemporaryDirectory(prefix='auth-infograph-') as td:
        for m in args.map:
            safe, img = m.split(':',1)
            img_p=Path(img)
            if img_p.suffix.lower() in {'.jpg','.jpeg'}:
                png=Path(td)/f'{safe}.png'
                subprocess.check_call(['sips','-s','format','png',str(img_p),'--out',str(png)], stdout=subprocess.DEVNULL)
            else:
                png=img_p
            r=subprocess.run([sys.executable,str(script),'--safe-id',safe,'--image',str(png),'--accept','--note',args.note], capture_output=True, text=True)
            print(r.stdout)
            if r.returncode!=0:
                print(r.stderr, file=sys.stderr)
                sys.exit(r.returncode)
    print('OK', len(args.map))
if __name__=='__main__':
    main()
