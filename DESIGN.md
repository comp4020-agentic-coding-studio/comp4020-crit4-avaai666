# What this is

A playable bianzhong — a Chinese bronze chime-bell rack — in the browser.
Ten bells. Each bell sounds two different pitches depending on where you
hit it.

# The mechanic

One bell, two tones. Strike the centre of a bell (zhenggu, the 正鼓 point)
and you get one pitch. Strike the corner (cegu, the 侧鼓 point) and you get
a different pitch, a third higher. This is real: the bells have a
lens-shaped rather than circular cross-section, which gives two independent
vibration modes.

The strike point is continuous, not a two-way switch. Let x be the
horizontal position of the strike inside the bell, 0 at the left edge, 1 at
the right edge. Let d = |x - 0.5| * 2, so d = 0 at the centre and d = 1 at
either edge.

    zhengguGain = cos(d * PI / 2)
    ceguGain    = sin(d * PI / 2)

Constant power: the two gains always satisfy zg^2 + cg^2 = 1. At the exact
centre the cegu mode is at a node and is silent. In between, both sound.

# Tuning

Pitches come from sanfen sunyi (三分损益法), the ancient Chinese method of
generating pitches by alternately taking 2/3 and 4/3 of a string length.
These are exact rational ratios against huangzhong (黄钟), not equal
temperament. Do not convert them to 12-TET. Do not recalculate them from
memory — use this table.

The twelve lü as frequency ratios to huangzhong:

    huangzhong 黄钟   1/1
    taicu      太簇   9/8
    guxian     姑洗   81/64
    ruibin     蕤宾   729/512
    linzhong   林钟   3/2
    nanlü      南吕   27/16
    yingzhong  应钟   243/128

Pythagorean thirds, used for the cegu interval:

    major third = 81/64
    minor third = 32/27

The ten bells. Bells 6-10 are bells 1-5 an octave up (ratio x 2).

    #   zhenggu           ratio      cegu              ratio       interval
    1   huangzhong 黄钟   1/1        guxian 姑洗       81/64       major
    2   taicu 太簇        9/8        ruibin 蕤宾       729/512     major
    3   guxian 姑洗       81/64      linzhong 林钟     3/2         minor
    4   linzhong 林钟     3/2        yingzhong 应钟    243/128     major
    5   nanlü 南吕        27/16      huangzhong 黄钟   2/1         minor
    6   huangzhong 黄钟   2/1        guxian 姑洗       81/32       major
    7   taicu 太簇        9/4        ruibin 蕤宾       729/256     major
    8   guxian 姑洗       81/32      linzhong 林钟     3/1         minor
    9   linzhong 林钟     3/1        yingzhong 应钟    243/64      major
    10  nanlü 南吕        27/8       huangzhong 黄钟   4/1         minor

Why this matters, and it is the whole point of the design: the zhenggu
pitches are a pentatonic scale (宫商角徵羽). Hit only centres and nothing
can clash. The cegu pitches are where ruibin and yingzhong come in — the
notes outside the pentatonic. The extra colour is on the corners of the
bells, not on extra bells. That is historically what the second tone was
for.

Starting frequency for huangzhong: 261.63 Hz. This is a guess and is to be
tuned by ear. Flag it in the code as such.

# Labels

Each bell carries its zhenggu lü name in Chinese characters: 黄钟 太簇
姑洗 林钟 南吕, repeated across the two tiers, exactly as the same lü names
repeat across tiers on the real rack. No pinyin on the bell. No Western
note names anywhere in the interface.

# Opening

The page opens with one bell. Nothing else. No overlay, no "click to enable
sound" button, no instructions.

The first pointerdown does three things at once: creates and resumes the
AudioContext, strikes that bell, and then reveals two faint strike marks on
the bell — one at the centre, one at the corner. The marks fade out after a
few seconds. Then the other nine bells fade in.

The browser requires a user gesture before audio can start. That
requirement is the opening screen, not an obstacle to it.

# Playing

- Mouse and touch: pointerdown on a bell strikes it. The x position inside
  that bell sets the tone mix.
- Sweep: hold and drag across the rack. A bell strikes when the pointer
  enters it. This is a glissando across the rack.
- Keyboard: a s d f g h j k l ; strike the ten bells at their zhenggu point.
  q w e r t y u i o p strike the same ten bells at their cegu point. The
  row above gives the tone above. Each bell is also a real focusable
  button; Enter and Space strike it at the centre.

# Timbre

Additive synthesis. No samples. Each struck tone is a fundamental plus
inharmonic partials with a fast attack and an exponential decay, plus a
very short noise transient for the mallet.

Starting values, all to be tuned by ear and all marked as guesses:

    partial ratios   1, 2.0, 2.4, 3.0, 4.1, 5.4
    partial gains    1, 0.35, 0.28, 0.18, 0.10, 0.06
    decay multiplier 1, 0.7, 0.6, 0.45, 0.3, 0.22
    decay time       4.5 s for bell 1 falling to 1.6 s for bell 10
    noise transient  about 8 ms

Bianzhong damp faster than European church bells, which is what makes them
playable melodically rather than a wash. I have not sourced that claim.
Treat it as inferred until checked.

# Not in this

No score. No timer. No target melody. No fail state. No settings. No
tutorial. No instruction paragraph. No emoji.
