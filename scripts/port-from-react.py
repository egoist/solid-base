#!/usr/bin/env python3
"""Mechanical first pass for porting a Base UI React file to the Solid port.
Usage: port.py <upstream-file> <dest-file>
Only handles type-level/import-level rewrites. Logic must still be ported by hand."""
import re, sys
src, dst = sys.argv[1], sys.argv[2]
s = open(src).read()
s = s.replace("'use client';\n", "")
s = s.replace("@base-ui/utils/", "@egoist/solid-base-utils/")
s = re.sub(r"import (type )?\* as React from 'react';\n", "", s)
reps = [
  (r"React\.RefObject<", "RefObject<"),
  (r"React\.MutableRefObject<", "RefObject<"),
  (r"React\.KeyboardEvent(<[^>]*>)?", "KeyboardEvent"),
  (r"React\.MouseEvent(<[^>]*>)?", "MouseEvent"),
  (r"React\.PointerEvent(<[^>]*>)?", "PointerEvent"),
  (r"React\.FocusEvent(<[^>]*>)?", "FocusEvent"),
  (r"React\.TouchEvent(<[^>]*>)?", "TouchEvent"),
  (r"React\.WheelEvent(<[^>]*>)?", "WheelEvent"),
  (r"React\.ChangeEvent(<[^>]*>)?", "Event"),
  (r"React\.FormEvent(<[^>]*>)?", "Event"),
  (r"React\.SyntheticEvent(<[^>]*>)?", "Event"),
  (r"React\.CSSProperties", "JSX.CSSProperties"),
  (r"React\.ReactNode", "JSX.Element"),
  (r"\.nativeEvent\b", ""),
  (r"from '@egoist/solid-base-utils/useTimeout'", "from '@egoist/solid-base-utils/timeout'"),
  (r"from '@egoist/solid-base-utils/useAnimationFrame'", "from '@egoist/solid-base-utils/animationFrame'"),
  (r"from '@egoist/solid-base-utils/useInterval'", "from '@egoist/solid-base-utils/interval'"),
  (r"from '@egoist/solid-base-utils/useScrollLock'", "from '@egoist/solid-base-utils/scrollLock'"),
]
for a, b in reps:
  s = re.sub(a, b, s)
head = []
if "RefObject<" in s and "import type { RefObject }" not in s:
  head.append("import type { RefObject } from '@egoist/solid-base-utils/refObject';")
if "JSX." in s and "from '@solidjs/web'" not in s:
  head.append("import type { JSX } from '@solidjs/web';")
if head:
  s = "\n".join(head) + "\n" + s
open(dst, "w").write(s)
