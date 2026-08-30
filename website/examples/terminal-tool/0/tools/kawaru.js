_.invoke.kawaru = (input, cb) => {
  const data = {
    "kya": {
      "h": "\u304d\u3083",
      "k": "\u30ad\u30e3"
    },
    "sha": {
      "h": "\u3057\u3083",
      "k": "\u30b7\u30e3"
    },
    "cha": {
      "h": "\u3061\u3083",
      "k": "\u30c1\u30e3"
    },
    "nya": {
      "h": "\u306b\u3083",
      "k": "\u30cb\u30e3"
    },
    "hya": {
      "h": "\u3072\u3083",
      "k": "\u30d2\u30e3"
    },
    "kyu": {
      "h": "\u304d\u3085",
      "k": "\u30ad\u30e5"
    },
    "shu": {
      "h": "\u3057\u3085",
      "k": "\u30b7\u30e5"
    },
    "chu": {
      "h": "\u3061\u3085",
      "k": "\u30c1\u30e5"
    },
    "nyu": {
      "h": "\u306b\u3085",
      "k": "\u30cb\u30e5"
    },
    "hyu": {
      "h": "\u3072\u3085",
      "k": "\u30d2\u30e5"
    },
    "kyo": {
      "h": "\u304d\u3087",
      "k": "\u30ad\u30e7"
    },
    "sho": {
      "h": "\u3057\u3087",
      "k": "\u30b7\u30e7"
    },
    "cho": {
      "h": "\u3061\u3087",
      "k": "\u30c1\u30e7"
    },
    "nyo": {
      "h": "\u306b\u3087",
      "k": "\u30cb\u30e7"
    },
    "hyo": {
      "h": "\u3072\u3087",
      "k": "\u30d2\u30e7"
    },
    "mya": {
      "h": "\u307f\u3083",
      "k": "\u30df\u30e3"
    },
    "rya": {
      "h": "\u308a\u3083",
      "k": "\u30ea\u30e3"
    },
    "gya": {
      "h": "\u304e\u3083",
      "k": "\u30ae\u30e3"
    },
    "ja": {
      "h": "\u3058\u3083",
      "k": "\u30b8\u30e3"
    },
    "bya": {
      "h": "\u3073\u3083",
      "k": "\u30d3\u30e3"
    },
    "myu": {
      "h": "\u307f\u3085",
      "k": "\u30df\u30e5"
    },
    "ryu": {
      "h": "\u308a\u3085",
      "k": "\u30ea\u30e5"
    },
    "gyu": {
      "h": "\u304e\u3085",
      "k": "\u30ae\u30e5"
    },
    "ju": {
      "h": "\u3058\u3085",
      "k": "\u30b8\u30e5"
    },
    "byu": {
      "h": "\u3073\u3085",
      "k": "\u30d3\u30e5"
    },
    "myo": {
      "h": "\u307f\u3087",
      "k": "\u30df\u30e7"
    },
    "ryo": {
      "h": "\u308a\u3087",
      "k": "\u30ea\u30e7"
    },
    "gyo": {
      "h": "\u304e\u3087",
      "k": "\u30ae\u30e7"
    },
    "jo": {
      "h": "\u3058\u3087",
      "k": "\u30b8\u30e7"
    },
    "byo": {
      "h": "\u3073\u3087",
      "k": "\u30d3\u30e7"
    },
    "pya": {
      "h": "\u3074\u3083",
      "k": "\u30d4\u30e3"
    },
    "pyu": {
      "h": "\u3074\u3085",
      "k": "\u30d4\u30e5"
    },
    "pyo": {
      "h": "\u3074\u3087",
      "k": "\u30d4\u30e7"
    },
    "a": {
      "h": "\u3042",
      "k": "\u30a2"
    },
    "ka": {
      "h": "\u304b",
      "k": "\u30ab"
    },
    "sa": {
      "h": "\u3055",
      "k": "\u30b5"
    },
    "ta": {
      "h": "\u305f",
      "k": "\u30bf"
    },
    "na": {
      "h": "\u306a",
      "k": "\u30ca"
    },
    "i": {
      "h": "\u3044",
      "k": "\u30a4"
    },
    "ki": {
      "h": "\u304d",
      "k": "\u30ad"
    },
    "shi": {
      "h": "\u3057",
      "k": "\u30b7"
    },
    "chi": {
      "h": "\u3061",
      "k": "\u30c1"
    },
    "ni": {
      "h": "\u306b",
      "k": "\u30cb"
    },
    "u": {
      "h": "\u3046",
      "k": "\u30a6"
    },
    "ku": {
      "h": "\u304f",
      "k": "\u30af"
    },
    "su": {
      "h": "\u3059",
      "k": "\u30b9"
    },
    "tsu": {
      "h": "\u3064",
      "k": "\u30c4"
    },
    "nu": {
      "h": "\u306c",
      "k": "\u30cc"
    },
    "e": {
      "h": "\u3048",
      "k": "\u30a8"
    },
    "ke": {
      "h": "\u3051",
      "k": "\u30b1"
    },
    "se": {
      "h": "\u305b",
      "k": "\u30bb"
    },
    "te": {
      "h": "\u3066",
      "k": "\u30c6"
    },
    "ne": {
      "h": "\u306d",
      "k": "\u30cd"
    },
    "o": {
      "h": "\u304a",
      "k": "\u30aa"
    },
    "ko": {
      "h": "\u3053",
      "k": "\u30b3"
    },
    "so": {
      "h": "\u305d",
      "k": "\u30bd"
    },
    "to": {
      "h": "\u3068",
      "k": "\u30c8"
    },
    "no": {
      "h": "\u306e",
      "k": "\u30ce"
    },
    "ha": {
      "h": "\u306f",
      "k": "\u30cf"
    },
    "ma": {
      "h": "\u307e",
      "k": "\u30de"
    },
    "ra": {
      "h": "\u3089",
      "k": "\u30e9"
    },
    "hi": {
      "h": "\u3072",
      "k": "\u30d2"
    },
    "mi": {
      "h": "\u307f",
      "k": "\u30df"
    },
    "ri": {
      "h": "\u308a",
      "k": "\u30ea"
    },
    "hu": {
      "h": "\u3075",
      "k": "\u30d5"
    },
    "mu": {
      "h": "\u3080",
      "k": "\u30e0"
    },
    "ru": {
      "h": "\u308b",
      "k": "\u30eb"
    },
    "he": {
      "h": "\u3078",
      "k": "\u30d8"
    },
    "me": {
      "h": "\u3081",
      "k": "\u30e1"
    },
    "re": {
      "h": "\u308c",
      "k": "\u30ec"
    },
    "ho": {
      "h": "\u307b",
      "k": "\u30db"
    },
    "mo": {
      "h": "\u3082",
      "k": "\u30e2"
    },
    "ro": {
      "h": "\u308d",
      "k": "\u30ed"
    },
    "ga": {
      "h": "\u304c",
      "k": "\u30ac"
    },
    "za": {
      "h": "\u3056",
      "k": "\u30b6"
    },
    "da": {
      "h": "\u3060",
      "k": "\u30c0"
    },
    "ba": {
      "h": "\u3070",
      "k": "\u30d0"
    },
    "pa": {
      "h": "\u3071",
      "k": "\u30d1"
    },
    "gi": {
      "h": "\u304e",
      "k": "\u30ae"
    },
    "ji": {
      "h": "\u3058",
      "k": "\u30b8"
    },
    "bi": {
      "h": "\u3073",
      "k": "\u30d3"
    },
    "pi": {
      "h": "\u3074",
      "k": "\u30d4"
    },
    "gu": {
      "h": "\u3050",
      "k": "\u30b0"
    },
    "zu": {
      "h": "\u305a",
      "k": "\u30ba"
    },
    "bu": {
      "h": "\u3076",
      "k": "\u30d6"
    },
    "pu": {
      "h": "\u3077",
      "k": "\u30d7"
    },
    "ge": {
      "h": "\u3052",
      "k": "\u30b2"
    },
    "ze": {
      "h": "\u305c",
      "k": "\u30bc"
    },
    "de": {
      "h": "\u3067",
      "k": "\u30c7"
    },
    "be": {
      "h": "\u3079",
      "k": "\u30d9"
    },
    "pe": {
      "h": "\u307a",
      "k": "\u30da"
    },
    "go": {
      "h": "\u3054",
      "k": "\u30b4"
    },
    "zo": {
      "h": "\u305e",
      "k": "\u30be"
    },
    "do": {
      "h": "\u3069",
      "k": "\u30c9"
    },
    "bo": {
      "h": "\u307c",
      "k": "\u30dc"
    },
    "po": {
      "h": "\u307d",
      "k": "\u30dd"
    },
    "ya": {
      "h": "\u3084",
      "k": "\u30e4"
    },
    "wa": {
      "h": "\u308f",
      "k": "\u30ef"
    },
    "yu": {
      "h": "\u3086",
      "k": "\u30e6"
    },
    "yo": {
      "h": "\u3088",
      "k": "\u30e8"
    },
    "n": {
      "h": "\u3093",
      "k": "\u30f3"
    },
    "-": {
      "h": "\u3063",
      "k": "\u30fc"
    }
  }

  const kana = {
    hiragana: 'hiragana',
    katakana: 'katakana',
    kanji: 'kanji',
  }
  let selectedKana = kana.hiragana
  let response = ''
  let error
  const arr = []
  let previousChar
  const vowels = 'aiueo'
  for (let i = 0; i < input.length; i++) { arr.push(input[i]) }

  while (arr.length) {
    if (~vowels.indexOf(arr[0])) {
      const char = selectedKana === kana.hiragana ? data[arr[0]]?.h : data[arr[0]]?.k
      if (!char) { throw Error(`failed to find ${selectedKana} for ${arr[0]}, input: ${input}, res: ${response}`) }
      if (previousChar === arr[0]) {
        response += selectedKana === kana.hiragana ? data['-']?.h : data['-']?.k
        previousChar = undefined
      } else {
        previousChar = arr[0]
        response += char
      }
      arr.splice(0, 1)
      continue
    }
    // TODO: handle 'n' chars, fug
    /*
    there are a few okish ways we can handle normal chars.
    - try the first two chars, and if they dont work, try the first 3 chars. if
      that fails, fail the attempt
    - keep plucking chars until it matches

    'n' chars mess this whole thing up tremendously though, so lets build without
    handling them for now

    went with something else that solves the 'n' issue. I dont think its 100% impervious though,
    so flex it to see it fail

    ISSUES:
      - Kawaru Sueeden = スエーデン
        Genki  Sueeden = スウエーデン(with a tiny エ)
    */

    const loopResult = [
      {success:false}, // 1 char
      {success:false}, // 2 chars
      {success:false}, // 3 chars
    ]

    // 1 char attempt
    const char0 = selectedKana === kana.hiragana ? data[arr[0]]?.h : data[arr[0]]?.k
    if (char0) {
      loopResult[0].success = true
      loopResult[0].char = char0
      previousChar = arr[0]
    }
    // 2 char attempt
    if (arr.length > 1) {
      const char1 = selectedKana === kana.hiragana ? data[`${arr[0]}${arr[1]}`]?.h : data[`${arr[0]}${arr[1]}`]?.k
      if (char1) {
        loopResult[1].success = true
        loopResult[1].char = char1
        previousChar = arr[1]
      }
    }
    // 3 char attempt
    if (arr.length > 2) {
      const char2 = selectedKana === kana.hiragana ? data[`${arr[0]}${arr[1]}${arr[2]}`]?.h : data[`${arr[0]}${arr[1]}${arr[2]}`]?.k
      if (char2) {
        loopResult[2].success = true
        loopResult[2].char = char2
        previousChar = arr[2]
      }
    }

    // longest kana has priority
    if (loopResult[2].success) {
      arr.splice(0, 3)
      response += loopResult[2].char
      continue
    } else if (loopResult[1].success) {
      arr.splice(0, 2)
      response += loopResult[1].char
      continue
    } else if (loopResult[0].success) {
      arr.splice(0, 1)
      response += loopResult[0].char
      continue
    } else {
      error = `failed to find ${selectedKana} in ${arr.join('')}, input: ${input}, res: ${response}`
      console.error(error)
      arr.length = 0
    }

    throw Error(`should not actually get this low`)
  }

  console.log('KAWARU RESULT:', response)
  if (typeof cb === 'function') cb(error, response)
  return response
}