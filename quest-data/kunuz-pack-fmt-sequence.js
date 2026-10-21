KZV.register({
  "slug": "fmt-sequence",
  "stamp": "456-50c21830",
  "cats": [
    {
      "id": "fmt-sequence",
      "name": "تسلسل منطقي",
      "kind": "general",
      "group": "science"
    }
  ],
  "qs": [
    {
      "id": "fmt-sequence-0001",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "6، 26، 46، 66، ؟ الفروق بين الحدود المتجاورة ثابتة وموجبة. ما العدد التالي؟",
      "choices": [
        "26",
        "86",
        "126",
        "146"
      ],
      "answer": 1,
      "why": "الفرق الثابت هو 20؛ لذلك 66 + 20 = 86.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0002",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "21، 32، 45، 60، ؟ الحدود مربعات أعداد صحيحة موجبة متتالية تصاعديا، أضيف إليها عدد صحيح ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "32",
        "45",
        "60",
        "77"
      ],
      "answer": 3,
      "why": "الحدود هي المربعات ابتداء من 5² مع إضافة -4؛ لذلك التالي 9² − 4 = 77.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0003",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "24، 72، 216، ؟ نسبة كل حد إلى سابقه ثابتة وأكبر من 1. ما العدد التالي؟",
      "choices": [
        "288",
        "432",
        "648",
        "864"
      ],
      "answer": 2,
      "why": "كل حد ناتج ضرب سابقه في 3؛ إذن 216 × 3 = 648.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0004",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "12، 37، 73، 122، ؟ الفروق بين الحدود المتجاورة مربعات أعداد صحيحة موجبة متتالية تصاعديا. ما العدد التالي؟",
      "choices": [
        "158",
        "186",
        "222",
        "243"
      ],
      "answer": 1,
      "why": "الفروق 25، 36، 49 هي مربعات 5، 6، 7؛ التالي 8² = 64، ثم 122 + 64 = 186.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0005",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "10، 37، 118، 361، ؟ كل حد يساوي سابقه مضروبا في عدد صحيح ثابت أكبر من 1، ثم مضافا إليه عدد صحيح ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "722",
        "729",
        "736",
        "1090"
      ],
      "answer": 3,
      "why": "في كل انتقال نضرب في 3 ثم نضيف 7؛ لذلك 3 × 361 + 7 = 1090.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0006",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "9، 4، 17، 38، 93، ؟ من الحد الثالث، كل حد يساوي حاصل ضرب سابقه في 2، مضافا إليه ما قبله. ما العدد التالي؟",
      "choices": [
        "224",
        "279",
        "300",
        "355"
      ],
      "answer": 0,
      "why": "نضرب الحد الأخير في 2 ثم نضيف ما قبله: 2 × 93 + 38 = 224.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0008",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "9، 12، 11، 14، 13، 16، ؟ الفروق بين الحدود المتجاورة تتناوب بين قيمتين ثابتتين مختلفتين غير صفريتين. ما العدد التالي؟",
      "choices": [
        "12",
        "13",
        "14",
        "15"
      ],
      "answer": 3,
      "why": "الفروق تتناوب بين 3 و-1؛ الدور الآن لإضافة -1، لذلك 16 − 1 = 15.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0009",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "10، 6، 15، 12، 20، 24، ؟ المواضع الفردية متتالية حسابية بفرق غير صفري، والمواضع الزوجية متتالية هندسية بنسبة أكبر من 1. ما العدد التالي؟",
      "choices": [
        "10",
        "15",
        "24",
        "25"
      ],
      "answer": 3,
      "why": "فرق المواضع الفردية 5، ونسبة الزوجية 2؛ المطلوب من المواضع الفردية، وبعد 20 يأتي 25 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0010",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "4، 23، 42، 61، ؟ الفروق بين الحدود المتجاورة ثابتة وموجبة. ما العدد التالي؟",
      "choices": [
        "23",
        "61",
        "80",
        "118"
      ],
      "answer": 2,
      "why": "الفرق الثابت هو 19؛ لذلك 61 + 19 = 80.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0011",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "6، 12، 13، 26، 27، ؟ تتناوب عمليتا الضرب في عدد صحيح ثابت أكبر من 1 والجمع مع عدد صحيح ثابت غير صفري، بدءا بالضرب. ما العدد التالي؟",
      "choices": [
        "28",
        "53",
        "54",
        "55"
      ],
      "answer": 2,
      "why": "تتناوب عمليتا الضرب في 2 وإضافة 1؛ الدور الآن للضرب، لذلك 27 × 2 = 54.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0012",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "27، 52، 88، 137، ؟ الفروق بين الحدود المتجاورة مربعات أعداد صحيحة موجبة متتالية تصاعديا. ما العدد التالي؟",
      "choices": [
        "173",
        "201",
        "237",
        "258"
      ],
      "answer": 1,
      "why": "الفروق 25، 36، 49 هي مربعات 5، 6، 7؛ التالي 8² = 64، ثم 137 + 64 = 201.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0013",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "13، 19، 29، 37، ؟ الحدود أعداد أولية تصاعديا؛ يؤخذ عدد أولي ويترك الذي يليه، ويتكرر ذلك. ما العدد التالي؟",
      "choices": [
        "31",
        "43",
        "53",
        "59"
      ],
      "answer": 1,
      "why": "بعد 37 يأتي الأولي 41 فنتركه، ثم نأخذ 43، مع استمرار أخذ أولي وترك الذي يليه.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0014",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "6، 9، 18، 45، 126، ؟ الفروق بين الحدود المتجاورة موجبة، ونسبة كل فرق إلى سابقه عدد صحيح ثابت أكبر من 1. ما العدد التالي؟",
      "choices": [
        "369",
        "378",
        "450",
        "531"
      ],
      "answer": 0,
      "why": "الفروق هي 3، 9، 27، 81، ونسبتها 3؛ الفرق التالي 243، فيكون 126 + 243 = 369.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0015",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "171، 190، 210، 231، ؟ الحدود أعداد مثلثية متتالية بخطوة ثابتة في ترتيبها؛ والعدد المثلثي هو مجموع الأعداد من 1 إلى عدد صحيح موجب. ما العدد التالي؟",
      "choices": [
        "190",
        "210",
        "253",
        "300"
      ],
      "answer": 2,
      "why": "ترتيب الأعداد المثلثية المعروضة هو 18، 19، 20، 21؛ التالي في الترتيب 22، وقيمته 22 × 23 ÷ 2 = 253.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0017",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "14، 22، 49، 113، ؟ الفروق بين الحدود المتجاورة مكعبات أعداد صحيحة موجبة متتالية تصاعديا. ما العدد التالي؟",
      "choices": [
        "140",
        "238",
        "456",
        "625"
      ],
      "answer": 1,
      "why": "الفروق 8، 27، 64 هي مكعبات 2، 3، 4؛ التالي 5³ = 125، ثم 113 + 125 = 238.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0018",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "12، 20، 32، 48، 68، ؟ الفروق بين الحدود المتجاورة تتغير بمقدار ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "92",
        "96",
        "100",
        "104"
      ],
      "answer": 0,
      "why": "الفروق هي 8، 12، 16، 20، وتتغير بمقدار 4؛ الفرق التالي 24، فيكون 68 + 24 = 92.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0019",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "21، 30، 41، 54، ؟ الحدود مربعات أعداد صحيحة موجبة متتالية تصاعديا، أضيف إليها عدد صحيح ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "30",
        "41",
        "64",
        "69"
      ],
      "answer": 3,
      "why": "الحدود هي المربعات ابتداء من 4² مع إضافة 5؛ لذلك التالي 8² + 5 = 69.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0020",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "64، 216، 512، ؟ الحدود مكعبات أعداد صحيحة موجبة تتحرك بخطوة ثابتة غير صفرية. ما العدد التالي؟",
      "choices": [
        "343",
        "1000",
        "1728",
        "2197"
      ],
      "answer": 1,
      "why": "الجذور التكعيبية الموجبة هي 4، 6، 8، وخطوتها 2؛ التالي 10، و10³ = 1000.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0021",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "729، 343، 125، ؟ الحدود مكعبات أعداد صحيحة موجبة تتحرك بخطوة ثابتة غير صفرية. ما العدد التالي؟",
      "choices": [
        "1",
        "27",
        "29",
        "216"
      ],
      "answer": 1,
      "why": "الجذور التكعيبية الموجبة هي 9، 7، 5، وخطوتها -2؛ التالي 3، و3³ = 27.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0022",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "112، 175، 252، 343، ؟ الحدود مربعات أعداد صحيحة موجبة متتالية تصاعديا، ضربت في عدد صحيح ثابت أكبر من 1. ما العدد التالي؟",
      "choices": [
        "175",
        "252",
        "441",
        "448"
      ],
      "answer": 3,
      "why": "كل حد مربع عدد متتال مضروبا في 7؛ التالي 7 × 8² = 448.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0023",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "5، 15، 17، 51، 53، 159، ؟ تتناوب عمليتا الضرب في عدد صحيح ثابت أكبر من 1 والجمع مع عدد صحيح ثابت غير صفري، بدءا بالضرب. ما العدد التالي؟",
      "choices": [
        "159",
        "160",
        "161",
        "163"
      ],
      "answer": 2,
      "why": "تتناوب عمليتا الضرب في 3 وإضافة 2؛ الدور الآن للجمع، لذلك 159 + 2 = 161.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0025",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "5، 10، 20، 40، ؟ نسبة كل حد إلى سابقه ثابتة وأكبر من 1. ما العدد التالي؟",
      "choices": [
        "60",
        "80",
        "120",
        "160"
      ],
      "answer": 1,
      "why": "كل حد ناتج ضرب سابقه في 2؛ إذن 40 × 2 = 80.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0026",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "1، 27، 125، ؟ الحدود مكعبات أعداد صحيحة موجبة تتحرك بخطوة ثابتة غير صفرية. ما العدد التالي؟",
      "choices": [
        "343",
        "345",
        "729",
        "1000"
      ],
      "answer": 0,
      "why": "الجذور التكعيبية الموجبة هي 1، 3، 5، وخطوتها 2؛ التالي 7، و7³ = 343.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0027",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "1600، 400، 100، ؟ نسبة كل حد إلى سابقه ثابتة وبين 0 و1. ما العدد التالي؟",
      "choices": [
        "20",
        "21",
        "24",
        "25"
      ],
      "answer": 3,
      "why": "كل حد ناتج قسمة سابقه على 4؛ إذن 100 ÷ 4 = 25.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0028",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "7، 21، 11، 23، 15، 25، ؟ المواضع الفردية متتالية حسابية، والمواضع الزوجية متتالية حسابية أخرى؛ والفرق في كل منهما غير صفري. ما العدد التالي؟",
      "choices": [
        "7",
        "11",
        "18",
        "19"
      ],
      "answer": 3,
      "why": "فرق المواضع الفردية 4، وفرق الزوجية 2؛ المطلوب من المواضع الفردية، وبعد 15 يأتي 19 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0029",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "12، 19، 33، 61، ؟ كل حد يساوي سابقه مضروبا في عدد صحيح ثابت أكبر من 1، ثم مضافا إليه عدد صحيح ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "61",
        "117",
        "173",
        "178"
      ],
      "answer": 1,
      "why": "في كل انتقال نضرب في 2 ثم نضيف -5؛ لذلك 2 × 61 − 5 = 117.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0030",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "5، 20، 45، 80، ؟ الحدود مربعات أعداد صحيحة موجبة متتالية تصاعديا، ضربت في عدد صحيح ثابت أكبر من 1. ما العدد التالي؟",
      "choices": [
        "45",
        "125",
        "245",
        "320"
      ],
      "answer": 1,
      "why": "كل حد مربع عدد متتال مضروبا في 5؛ التالي 5 × 5² = 125.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0031",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "17، 24، 33، 44، ؟ الحدود مربعات أعداد صحيحة موجبة متتالية تصاعديا، أضيف إليها عدد صحيح ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "24",
        "33",
        "57",
        "89"
      ],
      "answer": 2,
      "why": "الحدود هي المربعات ابتداء من 3² مع إضافة 8؛ لذلك التالي 7² + 8 = 57.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0032",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "3، 17، 6، 51، 12، 153، ؟ المواضع الفردية متتالية هندسية، والمواضع الزوجية متتالية هندسية أخرى؛ والنسبة في كل منهما أكبر من 1. ما العدد التالي؟",
      "choices": [
        "3",
        "6",
        "24",
        "48"
      ],
      "answer": 2,
      "why": "نسبة المواضع الفردية 2، ونسبة الزوجية 3؛ المطلوب من المواضع الفردية، وبعد 12 يأتي 24 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0033",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "14، 12، 11، 17، 8، 22، ؟ المواضع الفردية متتالية حسابية، والمواضع الزوجية متتالية حسابية أخرى؛ والفرق في كل منهما غير صفري. ما العدد التالي؟",
      "choices": [
        "5",
        "6",
        "11",
        "14"
      ],
      "answer": 0,
      "why": "فرق المواضع الفردية -3، وفرق الزوجية 5؛ المطلوب من المواضع الفردية، وبعد 8 يأتي 5 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0034",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "12، 19، 27، 36، 46، ؟ الفروق بين الحدود المتجاورة تتغير بمقدار ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "57",
        "58",
        "59",
        "60"
      ],
      "answer": 0,
      "why": "الفروق هي 7، 8، 9، 10، وتتغير بمقدار 1؛ الفرق التالي 11، فيكون 46 + 11 = 57.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0035",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "1، 4، 2، 7، 13، 22، ؟ من الحد الرابع، كل حد يساوي مجموع الحدود الثلاثة السابقة مباشرة. ما العدد التالي؟",
      "choices": [
        "42",
        "44",
        "55",
        "64"
      ],
      "answer": 0,
      "why": "نجمع آخر ثلاثة حدود: 7 + 13 + 22 = 42.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0036",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "4، 13، 21، 28، 34، ؟ الفروق بين الحدود المتجاورة تتغير بمقدار ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "39",
        "40",
        "41",
        "42"
      ],
      "answer": 0,
      "why": "الفروق هي 9، 8، 7، 6، وتتغير بمقدار -1؛ الفرق التالي 5، فيكون 34 + 5 = 39.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0037",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "513، 171، 57، ؟ نسبة كل حد إلى سابقه ثابتة وبين 0 و1. ما العدد التالي؟",
      "choices": [
        "16",
        "18",
        "19",
        "22"
      ],
      "answer": 2,
      "why": "كل حد ناتج قسمة سابقه على 3؛ إذن 57 ÷ 3 = 19.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0038",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "8، 17، 44، 125، ؟ كل حد يساوي سابقه مضروبا في عدد صحيح ثابت أكبر من 1، ثم مضافا إليه عدد صحيح ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "243",
        "250",
        "368",
        "486"
      ],
      "answer": 2,
      "why": "في كل انتقال نضرب في 3 ثم نضيف -7؛ لذلك 3 × 125 − 7 = 368.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0039",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "1024، 256، 64، ؟ نسبة كل حد إلى سابقه ثابتة وبين 0 و1. ما العدد التالي؟",
      "choices": [
        "8",
        "12",
        "15",
        "16"
      ],
      "answer": 3,
      "why": "كل حد ناتج قسمة سابقه على 4؛ إذن 64 ÷ 4 = 16.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0040",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "13، 52، 208، ؟ نسبة كل حد إلى سابقه ثابتة وأكبر من 1. ما العدد التالي؟",
      "choices": [
        "624",
        "832",
        "1040",
        "1248"
      ],
      "answer": 1,
      "why": "كل حد ناتج ضرب سابقه في 4؛ إذن 208 × 4 = 832.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0042",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "47، 62، 79، 98، ؟ الحدود مربعات أعداد صحيحة موجبة متتالية تصاعديا، أضيف إليها عدد صحيح ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "79",
        "119",
        "167",
        "194"
      ],
      "answer": 1,
      "why": "الحدود هي المربعات ابتداء من 7² مع إضافة -2؛ لذلك التالي 11² − 2 = 119.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0043",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "543، 181، 183، 61، 63، ؟ تتناوب عمليتا القسمة على عدد صحيح ثابت أكبر من 1 والجمع مع عدد صحيح ثابت غير صفري، بدءا بالقسمة. ما العدد التالي؟",
      "choices": [
        "21",
        "23",
        "24",
        "63"
      ],
      "answer": 0,
      "why": "تتناوب القسمة على 3 وإضافة 2؛ الدور الآن للقسمة: 63 ÷ 3 = 21.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0044",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "4، 1، 5، 10، 16، 31، ؟ من الحد الرابع، كل حد يساوي مجموع الحدود الثلاثة السابقة مباشرة. ما العدد التالي؟",
      "choices": [
        "57",
        "62",
        "73",
        "88"
      ],
      "answer": 0,
      "why": "نجمع آخر ثلاثة حدود: 10 + 16 + 31 = 57.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0045",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "1، 6، 13، 32، 77، ؟ من الحد الثالث، كل حد يساوي حاصل ضرب سابقه في 2، مضافا إليه ما قبله. ما العدد التالي؟",
      "choices": [
        "141",
        "173",
        "186",
        "231"
      ],
      "answer": 2,
      "why": "نضرب الحد الأخير في 2 ثم نضيف ما قبله: 2 × 77 + 32 = 186.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0046",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "25، 6، 36، 7، 49، 8، 64، ؟ المواضع الفردية مربعات أعداد صحيحة موجبة متتالية تصاعديا، والمواضع الزوجية متتالية حسابية بفرق غير صفري. ما العدد التالي؟",
      "choices": [
        "9",
        "10",
        "11",
        "12"
      ],
      "answer": 0,
      "why": "المواضع الفردية مربعات 5، 6، 7، 8، وفرق الزوجية 1؛ المطلوب من المواضع الزوجية، وبعد 8 يأتي 9 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0047",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "2، 8، 18، 32، ؟ الحدود مربعات أعداد صحيحة موجبة متتالية تصاعديا، ضربت في عدد صحيح ثابت أكبر من 1. ما العدد التالي؟",
      "choices": [
        "50",
        "52",
        "98",
        "128"
      ],
      "answer": 0,
      "why": "كل حد مربع عدد متتال مضروبا في 2؛ التالي 2 × 5² = 50.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0048",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "5، 3، 1، 9، 13، 23، ؟ من الحد الرابع، كل حد يساوي مجموع الحدود الثلاثة السابقة مباشرة. ما العدد التالي؟",
      "choices": [
        "22",
        "32",
        "45",
        "58"
      ],
      "answer": 2,
      "why": "نجمع آخر ثلاثة حدود: 9 + 13 + 23 = 45.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0049",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "72، 98، 128، 162، ؟ الحدود مربعات أعداد صحيحة موجبة متتالية تصاعديا، ضربت في عدد صحيح ثابت أكبر من 1. ما العدد التالي؟",
      "choices": [
        "200",
        "202",
        "288",
        "338"
      ],
      "answer": 0,
      "why": "كل حد مربع عدد متتال مضروبا في 2؛ التالي 2 × 10² = 200.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0050",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "72، 62، 52، 42، ؟ الفروق بين الحدود المتجاورة ثابتة وسالبة. ما العدد التالي؟",
      "choices": [
        "2",
        "12",
        "32",
        "62"
      ],
      "answer": 2,
      "why": "الفرق الثابت هو -10؛ لذلك 42 − 10 = 32.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0051",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "3، 1، 4، 5، 9، 14، ؟ من الحد الثالث، كل حد يساوي مجموع الحدين السابقين. ما العدد التالي؟",
      "choices": [
        "9",
        "14",
        "18",
        "23"
      ],
      "answer": 3,
      "why": "نجمع الحدين الأخيرين: 9 + 14 = 23.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0052",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "52، 26، 32، 16، 22، ؟ تتناوب عمليتا القسمة على عدد صحيح ثابت أكبر من 1 والجمع مع عدد صحيح ثابت غير صفري، بدءا بالقسمة. ما العدد التالي؟",
      "choices": [
        "11",
        "13",
        "17",
        "22"
      ],
      "answer": 0,
      "why": "تتناوب القسمة على 2 وإضافة 6؛ الدور الآن للقسمة: 22 ÷ 2 = 11.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0053",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "18، 32، 50، 72، ؟ الحدود مربعات أعداد صحيحة موجبة متتالية تصاعديا، ضربت في عدد صحيح ثابت أكبر من 1. ما العدد التالي؟",
      "choices": [
        "32",
        "50",
        "98",
        "162"
      ],
      "answer": 2,
      "why": "كل حد مربع عدد متتال مضروبا في 2؛ التالي 2 × 7² = 98.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0054",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "9، 30، 93، 282، ؟ كل حد يساوي سابقه مضروبا في عدد صحيح ثابت أكبر من 1، ثم مضافا إليه عدد صحيح ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "570",
        "849",
        "1128",
        "1131"
      ],
      "answer": 1,
      "why": "في كل انتقال نضرب في 3 ثم نضيف 3؛ لذلك 3 × 282 + 3 = 849.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0055",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "1، 3، 4، 7، 11، 18، ؟ من الحد الثالث، كل حد يساوي مجموع الحدين السابقين. ما العدد التالي؟",
      "choices": [
        "29",
        "33",
        "36",
        "51"
      ],
      "answer": 0,
      "why": "نجمع الحدين الأخيرين: 11 + 18 = 29.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0056",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "الخميس، الأربعاء، الثلاثاء، الاثنين، ؟ الأيام تسير إلى الأمام بخطوة ثابتة من 1 إلى 6 أيام، مع العودة بعد الجمعة إلى السبت. ما اليوم التالي؟",
      "choices": [
        "الثلاثاء",
        "الجمعة",
        "الاثنين",
        "الأحد"
      ],
      "answer": 3,
      "why": "نتقدم 6 أيام في كل انتقال؛ من الاثنين نصل إلى الأحد مع دوران الأسبوع.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0057",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "6، 30، 150، ؟ نسبة كل حد إلى سابقه ثابتة وأكبر من 1. ما العدد التالي؟",
      "choices": [
        "750",
        "755",
        "900",
        "1050"
      ],
      "answer": 0,
      "why": "كل حد ناتج ضرب سابقه في 5؛ إذن 150 × 5 = 750.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0059",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "4، 10، 21، 37، 58، ؟ الفروق بين الحدود المتجاورة تتغير بمقدار ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "69",
        "74",
        "79",
        "84"
      ],
      "answer": 3,
      "why": "الفروق هي 6، 11، 16، 21، وتتغير بمقدار 5؛ الفرق التالي 26، فيكون 58 + 26 = 84.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0060",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "1، 8، 27، ؟ الحدود مكعبات أعداد صحيحة موجبة تتحرك بخطوة ثابتة غير صفرية. ما العدد التالي؟",
      "choices": [
        "1",
        "8",
        "27",
        "64"
      ],
      "answer": 3,
      "why": "الجذور التكعيبية الموجبة هي 1، 2، 3، وخطوتها 1؛ التالي 4، و4³ = 64.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0061",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "104، 84، 64، 44، ؟ الفروق بين الحدود المتجاورة ثابتة وسالبة. ما العدد التالي؟",
      "choices": [
        "24",
        "44",
        "64",
        "84"
      ],
      "answer": 0,
      "why": "الفرق الثابت هو -20؛ لذلك 44 − 20 = 24.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0062",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "8، 24، 25، 19، 57، 58، 52، 156، ؟ تتكرر دورة: الضرب في عدد صحيح ثابت أكبر من 1، ثم إضافة عدد صحيح موجب ثابت، ثم طرح عدد صحيح موجب ثابت مختلف عنه. ما العدد التالي؟",
      "choices": [
        "157",
        "158",
        "159",
        "468"
      ],
      "answer": 0,
      "why": "الدورة هي ×3، ثم +1، ثم −6؛ العملية التالية إضافة 1، وناتجها 157.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0063",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "4، 10، 9، 12، 14، 14، ؟ المواضع الفردية متتالية حسابية، والمواضع الزوجية متتالية حسابية أخرى؛ والفرق في كل منهما غير صفري. ما العدد التالي؟",
      "choices": [
        "19",
        "20",
        "29",
        "34"
      ],
      "answer": 0,
      "why": "فرق المواضع الفردية 5، وفرق الزوجية 2؛ المطلوب من المواضع الفردية، وبعد 14 يأتي 19 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0064",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "8، 24، 31، 93، 100، ؟ تتناوب عمليتا الضرب في عدد صحيح ثابت أكبر من 1 والجمع مع عدد صحيح ثابت غير صفري، بدءا بالضرب. ما العدد التالي؟",
      "choices": [
        "293",
        "300",
        "303",
        "307"
      ],
      "answer": 1,
      "why": "تتناوب عمليتا الضرب في 3 وإضافة 7؛ الدور الآن للضرب، لذلك 100 × 3 = 300.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0066",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "6، 18، 12، 20، 18، 22، 24، ؟ المواضع الفردية متتالية حسابية، والمواضع الزوجية متتالية حسابية أخرى؛ والفرق في كل منهما غير صفري. ما العدد التالي؟",
      "choices": [
        "20",
        "24",
        "26",
        "28"
      ],
      "answer": 1,
      "why": "فرق المواضع الفردية 6، وفرق الزوجية 2؛ المطلوب من المواضع الزوجية، وبعد 22 يأتي 24 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0067",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "8، 24، 28، 84، 88، 264، ؟ تتناوب عمليتا الضرب في عدد صحيح ثابت أكبر من 1 والجمع مع عدد صحيح ثابت غير صفري، بدءا بالضرب. ما العدد التالي؟",
      "choices": [
        "264",
        "266",
        "267",
        "268"
      ],
      "answer": 3,
      "why": "تتناوب عمليتا الضرب في 3 وإضافة 4؛ الدور الآن للجمع، لذلك 264 + 4 = 268.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0068",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "8، 16، 28، 44، 64، ؟ الفروق بين الحدود المتجاورة تتغير بمقدار ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "80",
        "88",
        "96",
        "100"
      ],
      "answer": 1,
      "why": "الفروق هي 8، 12، 16، 20، وتتغير بمقدار 4؛ الفرق التالي 24، فيكون 64 + 24 = 88.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0069",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "10، 11، 14، 23، 50، ؟ الفروق بين الحدود المتجاورة موجبة، ونسبة كل فرق إلى سابقه عدد صحيح ثابت أكبر من 1. ما العدد التالي؟",
      "choices": [
        "104",
        "131",
        "150",
        "185"
      ],
      "answer": 1,
      "why": "الفروق هي 1، 3، 9، 27، ونسبتها 3؛ الفرق التالي 81، فيكون 50 + 81 = 131.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0070",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "ه، م، ك، ف، ؟ الحروف تتحرك بخطوة ثابتة غير صفرية في الترتيب الهجائي العربي المعتاد، من دون التفاف عند طرفيه. ما الحرف التالي؟",
      "choices": [
        "ص",
        "ط",
        "غ",
        "ع"
      ],
      "answer": 3,
      "why": "مواضع الحروف هي 26، 24، 22، 20، وخطوتها -2؛ الموضع التالي 18 وحرفه ع.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0071",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "3، 6، 8، 16، 18، ؟ تتناوب عمليتا الضرب في عدد صحيح ثابت أكبر من 1 والجمع مع عدد صحيح ثابت غير صفري، بدءا بالضرب. ما العدد التالي؟",
      "choices": [
        "36",
        "37",
        "38",
        "39"
      ],
      "answer": 0,
      "why": "تتناوب عمليتا الضرب في 2 وإضافة 2؛ الدور الآن للضرب، لذلك 18 × 2 = 36.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0073",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "9، 10، 16، 16، 25، 22، ؟ المواضع الفردية مربعات أعداد صحيحة موجبة متتالية تصاعديا، والمواضع الزوجية متتالية حسابية بفرق غير صفري. ما العدد التالي؟",
      "choices": [
        "9",
        "16",
        "36",
        "49"
      ],
      "answer": 2,
      "why": "المواضع الفردية مربعات 3، 4، 5، وفرق الزوجية 6؛ المطلوب من المواضع الفردية، وبعد 25 يأتي 36 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0074",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "3، 10، 19، 30، ؟ الحدود مربعات أعداد صحيحة موجبة متتالية تصاعديا، أضيف إليها عدد صحيح ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "10",
        "19",
        "43",
        "75"
      ],
      "answer": 2,
      "why": "الحدود هي المربعات ابتداء من 3² مع إضافة -6؛ لذلك التالي 7² − 6 = 43.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0075",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "44، 57، 72، 89، ؟ الحدود مربعات أعداد صحيحة موجبة متتالية تصاعديا، أضيف إليها عدد صحيح ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "57",
        "72",
        "108",
        "152"
      ],
      "answer": 2,
      "why": "الحدود هي المربعات ابتداء من 6² مع إضافة 8؛ لذلك التالي 10² + 8 = 108.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0076",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "15، 60، 240، ؟ نسبة كل حد إلى سابقه ثابتة وأكبر من 1. ما العدد التالي؟",
      "choices": [
        "720",
        "960",
        "1200",
        "1440"
      ],
      "answer": 1,
      "why": "كل حد ناتج ضرب سابقه في 4؛ إذن 240 × 4 = 960.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0077",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "6، 5، 11، 16، 27، 43، ؟ من الحد الثالث، كل حد يساوي مجموع الحدين السابقين. ما العدد التالي؟",
      "choices": [
        "70",
        "81",
        "86",
        "124"
      ],
      "answer": 0,
      "why": "نجمع الحدين الأخيرين: 27 + 43 = 70.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0078",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "5، 10، 20، 35، 55، ؟ الفروق بين الحدود المتجاورة تتغير بمقدار ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "70",
        "80",
        "90",
        "95"
      ],
      "answer": 1,
      "why": "الفروق هي 5، 10، 15، 20، وتتغير بمقدار 5؛ الفرق التالي 25، فيكون 55 + 25 = 80.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0079",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "6، 11، 7، 22، 8، 44، 9، ؟ المواضع الفردية متتالية حسابية بفرق غير صفري، والمواضع الزوجية متتالية هندسية بنسبة أكبر من 1. ما العدد التالي؟",
      "choices": [
        "22",
        "88",
        "176",
        "352"
      ],
      "answer": 1,
      "why": "فرق المواضع الفردية 1، ونسبة الزوجية 2؛ المطلوب من المواضع الزوجية، وبعد 44 يأتي 88 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0080",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "200، 288، 392، 512، ؟ الحدود مربعات أعداد صحيحة موجبة متتالية تصاعديا، ضربت في عدد صحيح ثابت أكبر من 1. ما العدد التالي؟",
      "choices": [
        "392",
        "648",
        "968",
        "1152"
      ],
      "answer": 1,
      "why": "كل حد مربع عدد متتال مضروبا في 8؛ التالي 8 × 9² = 648.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0081",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "8، 9، 11، 15، ؟ كل حد يساوي سابقه مضروبا في عدد صحيح ثابت أكبر من 1، ثم مضافا إليه عدد صحيح ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "23",
        "31",
        "38",
        "45"
      ],
      "answer": 0,
      "why": "في كل انتقال نضرب في 2 ثم نضيف -7؛ لذلك 2 × 15 − 7 = 23.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0082",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "8، 12، 14، 18، 20، ؟ الفروق بين الحدود المتجاورة تتناوب بين قيمتين ثابتتين مختلفتين غير صفريتين. ما العدد التالي؟",
      "choices": [
        "20",
        "22",
        "24",
        "28"
      ],
      "answer": 2,
      "why": "الفروق تتناوب بين 4 و2؛ الدور الآن لإضافة 4، لذلك 20 + 4 = 24.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0084",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "14، 9، 16، 12، 18، 15، 20، ؟ المواضع الفردية متتالية حسابية، والمواضع الزوجية متتالية حسابية أخرى؛ والفرق في كل منهما غير صفري. ما العدد التالي؟",
      "choices": [
        "9",
        "12",
        "18",
        "21"
      ],
      "answer": 2,
      "why": "فرق المواضع الفردية 2، وفرق الزوجية 3؛ المطلوب من المواضع الزوجية، وبعد 15 يأتي 18 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0085",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "225، 15، 256، 14، 289، 13، 324، ؟ المواضع الفردية مربعات أعداد صحيحة موجبة متتالية تصاعديا، والمواضع الزوجية متتالية حسابية بفرق غير صفري. ما العدد التالي؟",
      "choices": [
        "12",
        "13",
        "14",
        "15"
      ],
      "answer": 0,
      "why": "المواضع الفردية مربعات 15، 16، 17، 18، وفرق الزوجية -1؛ المطلوب من المواضع الزوجية، وبعد 13 يأتي 12 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0086",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "12، 32، 92، 272، ؟ كل حد يساوي سابقه مضروبا في عدد صحيح ثابت أكبر من 1، ثم مضافا إليه عدد صحيح ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "540",
        "544",
        "812",
        "1080"
      ],
      "answer": 2,
      "why": "في كل انتقال نضرب في 3 ثم نضيف -4؛ لذلك 3 × 272 − 4 = 812.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0087",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "11، 44، 176، ؟ نسبة كل حد إلى سابقه ثابتة وأكبر من 1. ما العدد التالي؟",
      "choices": [
        "220",
        "352",
        "528",
        "704"
      ],
      "answer": 3,
      "why": "كل حد ناتج ضرب سابقه في 4؛ إذن 176 × 4 = 704.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0088",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "6، 12، 9، 15، 12، 18، ؟ الفروق بين الحدود المتجاورة تتناوب بين قيمتين ثابتتين مختلفتين غير صفريتين. ما العدد التالي؟",
      "choices": [
        "15",
        "18",
        "21",
        "24"
      ],
      "answer": 0,
      "why": "الفروق تتناوب بين 6 و-3؛ الدور الآن لإضافة -3، لذلك 18 − 3 = 15.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0089",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "12، 21، 13، 24، 14، 27، ؟ المواضع الفردية متتالية حسابية، والمواضع الزوجية متتالية حسابية أخرى؛ والفرق في كل منهما غير صفري. ما العدد التالي؟",
      "choices": [
        "13",
        "15",
        "17",
        "18"
      ],
      "answer": 1,
      "why": "فرق المواضع الفردية 1، وفرق الزوجية 3؛ المطلوب من المواضع الفردية، وبعد 14 يأتي 15 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0090",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "18، 20، 26، 31، 33، 39، 44، 46، ؟ الفروق تتكرر في دورة من ثلاث قيم ثابتة مختلفة غير صفرية، بالترتيب نفسه. ما العدد التالي؟",
      "choices": [
        "51",
        "52",
        "53",
        "54"
      ],
      "answer": 1,
      "why": "الفروق تتكرر بالترتيب 2، 6، 5؛ الدور الآن لإضافة 6، لذلك 46 + 6 = 52.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0092",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "6، 14، 21، 27، 32، ؟ الفروق بين الحدود المتجاورة تتغير بمقدار ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "33",
        "34",
        "35",
        "36"
      ],
      "answer": 3,
      "why": "الفروق هي 8، 7، 6، 5، وتتغير بمقدار -1؛ الفرق التالي 4، فيكون 32 + 4 = 36.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0093",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "32، 27، 22، 17، ؟ الفروق بين الحدود المتجاورة ثابتة وسالبة. ما العدد التالي؟",
      "choices": [
        "2",
        "12",
        "17",
        "27"
      ],
      "answer": 1,
      "why": "الفرق الثابت هو -5؛ لذلك 17 − 5 = 12.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0094",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "31، 37، 41، 43، ؟ الحدود أعداد أولية متتالية تصاعديا. ما العدد التالي؟",
      "choices": [
        "41",
        "47",
        "59",
        "61"
      ],
      "answer": 1,
      "why": "الأعداد المعروضة أولية متتالية؛ أول عدد أولي بعد 43 هو 47.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0095",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "28، 21، 15، 10، ؟ الحدود أعداد مثلثية متتالية بخطوة ثابتة في ترتيبها؛ والعدد المثلثي هو مجموع الأعداد من 1 إلى عدد صحيح موجب. ما العدد التالي؟",
      "choices": [
        "1",
        "3",
        "5",
        "6"
      ],
      "answer": 3,
      "why": "ترتيب الأعداد المثلثية المعروضة هو 7، 6، 5، 4؛ التالي في الترتيب 3، وقيمته 3 × 4 ÷ 2 = 6.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0096",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "10، 15، 25، 45، 85، ؟ الفروق بين الحدود المتجاورة موجبة، ونسبة كل فرق إلى سابقه عدد صحيح ثابت أكبر من 1. ما العدد التالي؟",
      "choices": [
        "125",
        "164",
        "165",
        "245"
      ],
      "answer": 2,
      "why": "الفروق هي 5، 10، 20، 40، ونسبتها 2؛ الفرق التالي 80، فيكون 85 + 80 = 165.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0097",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "210، 231، 253، 276، ؟ الحدود أعداد مثلثية متتالية بخطوة ثابتة في ترتيبها؛ والعدد المثلثي هو مجموع الأعداد من 1 إلى عدد صحيح موجب. ما العدد التالي؟",
      "choices": [
        "231",
        "253",
        "300",
        "351"
      ],
      "answer": 2,
      "why": "ترتيب الأعداد المثلثية المعروضة هو 20، 21، 22، 23؛ التالي في الترتيب 24، وقيمته 24 × 25 ÷ 2 = 300.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0098",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "6، 1، 7، 8، 15، 23، ؟ من الحد الثالث، كل حد يساوي مجموع الحدين السابقين. ما العدد التالي؟",
      "choices": [
        "15",
        "30",
        "38",
        "45"
      ],
      "answer": 2,
      "why": "نجمع الحدين الأخيرين: 15 + 23 = 38.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0099",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "21، 28، 36، 45، ؟ الحدود أعداد مثلثية متتالية بخطوة ثابتة في ترتيبها؛ والعدد المثلثي هو مجموع الأعداد من 1 إلى عدد صحيح موجب. ما العدد التالي؟",
      "choices": [
        "28",
        "36",
        "55",
        "78"
      ],
      "answer": 2,
      "why": "ترتيب الأعداد المثلثية المعروضة هو 6، 7، 8، 9؛ التالي في الترتيب 10، وقيمته 10 × 11 ÷ 2 = 55.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0100",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "10، 15، 20، 45، 40، 135، 80، ؟ المواضع الفردية متتالية هندسية، والمواضع الزوجية متتالية هندسية أخرى؛ والنسبة في كل منهما أكبر من 1. ما العدد التالي؟",
      "choices": [
        "15",
        "45",
        "405",
        "1215"
      ],
      "answer": 2,
      "why": "نسبة المواضع الفردية 2، ونسبة الزوجية 3؛ المطلوب من المواضع الزوجية، وبعد 135 يأتي 405 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0101",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "49، 36، 25، 16، ؟ الحدود مربعات أعداد صحيحة موجبة تتحرك بخطوة ثابتة غير صفرية. ما العدد التالي؟",
      "choices": [
        "1",
        "4",
        "9",
        "25"
      ],
      "answer": 2,
      "why": "الجذور التربيعية الموجبة هي 7، 6، 5، 4، وخطوتها -1؛ التالي 3، و3² = 9.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0102",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "5، 21، 37، 53، ؟ الفروق بين الحدود المتجاورة ثابتة وموجبة. ما العدد التالي؟",
      "choices": [
        "69",
        "85",
        "101",
        "117"
      ],
      "answer": 0,
      "why": "الفرق الثابت هو 16؛ لذلك 53 + 16 = 69.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0103",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "20، 23، 22، 27، 30، 29، 34، 37، ؟ الفروق تتكرر في دورة من ثلاث قيم ثابتة مختلفة غير صفرية، بالترتيب نفسه. ما العدد التالي؟",
      "choices": [
        "35",
        "36",
        "37",
        "38"
      ],
      "answer": 1,
      "why": "الفروق تتكرر بالترتيب 3، -1، 5؛ الدور الآن لإضافة -1، لذلك 37 − 1 = 36.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0104",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "4، 21، 9، 20، 16، 19، 25، ؟ المواضع الفردية مربعات أعداد صحيحة موجبة متتالية تصاعديا، والمواضع الزوجية متتالية حسابية بفرق غير صفري. ما العدد التالي؟",
      "choices": [
        "18",
        "19",
        "20",
        "21"
      ],
      "answer": 0,
      "why": "المواضع الفردية مربعات 2، 3، 4، 5، وفرق الزوجية -1؛ المطلوب من المواضع الزوجية، وبعد 19 يأتي 18 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0105",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "13، 65، 325، ؟ نسبة كل حد إلى سابقه ثابتة وأكبر من 1. ما العدد التالي؟",
      "choices": [
        "975",
        "1300",
        "1625",
        "1950"
      ],
      "answer": 2,
      "why": "كل حد ناتج ضرب سابقه في 5؛ إذن 325 × 5 = 1625.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0106",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "ع، غ، ف، ق، ؟ الحروف تتحرك بخطوة ثابتة غير صفرية في الترتيب الهجائي العربي المعتاد، من دون التفاف عند طرفيه. ما الحرف التالي؟",
      "choices": [
        "غ",
        "م",
        "ع",
        "ك"
      ],
      "answer": 3,
      "why": "مواضع الحروف هي 18، 19، 20، 21، وخطوتها 1؛ الموضع التالي 22 وحرفه ك.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0107",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "4، 6، 10، 18، ؟ كل حد يساوي سابقه مضروبا في عدد صحيح ثابت أكبر من 1، ثم مضافا إليه عدد صحيح ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "14",
        "18",
        "32",
        "34"
      ],
      "answer": 3,
      "why": "في كل انتقال نضرب في 2 ثم نضيف -2؛ لذلك 2 × 18 − 2 = 34.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0108",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "20، 45، 80، 125، ؟ الحدود مربعات أعداد صحيحة موجبة متتالية تصاعديا، ضربت في عدد صحيح ثابت أكبر من 1. ما العدد التالي؟",
      "choices": [
        "45",
        "80",
        "180",
        "320"
      ],
      "answer": 2,
      "why": "كل حد مربع عدد متتال مضروبا في 5؛ التالي 5 × 6² = 180.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0109",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "192، 96، 48، 24، ؟ نسبة كل حد إلى سابقه ثابتة وبين 0 و1. ما العدد التالي؟",
      "choices": [
        "12",
        "14",
        "22",
        "24"
      ],
      "answer": 0,
      "why": "كل حد ناتج قسمة سابقه على 2؛ إذن 24 ÷ 2 = 12.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0110",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "125، 64، 27، ؟ الحدود مكعبات أعداد صحيحة موجبة تتحرك بخطوة ثابتة غير صفرية. ما العدد التالي؟",
      "choices": [
        "1",
        "6",
        "7",
        "8"
      ],
      "answer": 3,
      "why": "الجذور التكعيبية الموجبة هي 5، 4، 3، وخطوتها -1؛ التالي 2، و2³ = 8.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0111",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "8، 11، 13، 33، 18، 99، ؟ المواضع الفردية متتالية حسابية بفرق غير صفري، والمواضع الزوجية متتالية هندسية بنسبة أكبر من 1. ما العدد التالي؟",
      "choices": [
        "8",
        "13",
        "22",
        "23"
      ],
      "answer": 3,
      "why": "فرق المواضع الفردية 5، ونسبة الزوجية 3؛ المطلوب من المواضع الفردية، وبعد 18 يأتي 23 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0112",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "5، 10، 12، 24، 26، 52، ؟ تتناوب عمليتا الضرب في عدد صحيح ثابت أكبر من 1 والجمع مع عدد صحيح ثابت غير صفري، بدءا بالضرب. ما العدد التالي؟",
      "choices": [
        "51",
        "52",
        "53",
        "54"
      ],
      "answer": 3,
      "why": "تتناوب عمليتا الضرب في 2 وإضافة 2؛ الدور الآن للجمع، لذلك 52 + 2 = 54.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0113",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "10، 23، 9، 28، 8، 33، ؟ المواضع الفردية متتالية حسابية، والمواضع الزوجية متتالية حسابية أخرى؛ والفرق في كل منهما غير صفري. ما العدد التالي؟",
      "choices": [
        "7",
        "8",
        "9",
        "10"
      ],
      "answer": 0,
      "why": "فرق المواضع الفردية -1، وفرق الزوجية 5؛ المطلوب من المواضع الفردية، وبعد 8 يأتي 7 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0114",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "22، 31، 40، 49، ؟ الفروق بين الحدود المتجاورة ثابتة وموجبة. ما العدد التالي؟",
      "choices": [
        "31",
        "49",
        "58",
        "76"
      ],
      "answer": 2,
      "why": "الفرق الثابت هو 9؛ لذلك 49 + 9 = 58.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0115",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "7، 15، 24، 34، 45، ؟ الفروق بين الحدود المتجاورة تتغير بمقدار ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "54",
        "55",
        "56",
        "57"
      ],
      "answer": 3,
      "why": "الفروق هي 8، 9، 10، 11، وتتغير بمقدار 1؛ الفرق التالي 12، فيكون 45 + 12 = 57.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0116",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "3، 8، 16، 27، 41، ؟ الفروق بين الحدود المتجاورة تتغير بمقدار ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "49",
        "52",
        "58",
        "64"
      ],
      "answer": 2,
      "why": "الفروق هي 5، 8، 11، 14، وتتغير بمقدار 3؛ الفرق التالي 17، فيكون 41 + 17 = 58.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0117",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "81، 100، 121، 144، ؟ الحدود مربعات أعداد صحيحة موجبة تتحرك بخطوة ثابتة غير صفرية. ما العدد التالي؟",
      "choices": [
        "121",
        "169",
        "225",
        "256"
      ],
      "answer": 1,
      "why": "الجذور التربيعية الموجبة هي 9، 10، 11، 12، وخطوتها 1؛ التالي 13، و13² = 169.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0118",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "7، 3، 12، 6، 17، 9، 22، ؟ المواضع الفردية متتالية حسابية، والمواضع الزوجية متتالية حسابية أخرى؛ والفرق في كل منهما غير صفري. ما العدد التالي؟",
      "choices": [
        "3",
        "6",
        "12",
        "15"
      ],
      "answer": 2,
      "why": "فرق المواضع الفردية 5، وفرق الزوجية 3؛ المطلوب من المواضع الزوجية، وبعد 9 يأتي 12 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0119",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "9، 31، 97، 295، ؟ كل حد يساوي سابقه مضروبا في عدد صحيح ثابت أكبر من 1، ثم مضافا إليه عدد صحيح ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "598",
        "889",
        "1180",
        "1184"
      ],
      "answer": 1,
      "why": "في كل انتقال نضرب في 3 ثم نضيف 4؛ لذلك 3 × 295 + 4 = 889.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0120",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "9، 34، 70، 119، ؟ الفروق بين الحدود المتجاورة مربعات أعداد صحيحة موجبة متتالية تصاعديا. ما العدد التالي؟",
      "choices": [
        "144",
        "155",
        "183",
        "219"
      ],
      "answer": 2,
      "why": "الفروق 25، 36، 49 هي مربعات 5، 6، 7؛ التالي 8² = 64، ثم 119 + 64 = 183.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0121",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "9، 16، 25، 36، ؟ الحدود مربعات أعداد صحيحة موجبة تتحرك بخطوة ثابتة غير صفرية. ما العدد التالي؟",
      "choices": [
        "16",
        "25",
        "36",
        "49"
      ],
      "answer": 3,
      "why": "الجذور التربيعية الموجبة هي 3، 4، 5، 6، وخطوتها 1؛ التالي 7، و7² = 49.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0122",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "625، 125، 25، ؟ نسبة كل حد إلى سابقه ثابتة وبين 0 و1. ما العدد التالي؟",
      "choices": [
        "0",
        "5",
        "10",
        "20"
      ],
      "answer": 1,
      "why": "كل حد ناتج قسمة سابقه على 5؛ إذن 25 ÷ 5 = 5.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0123",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "9، 13، 8، 26، 7، 52، ؟ المواضع الفردية متتالية حسابية بفرق غير صفري، والمواضع الزوجية متتالية هندسية بنسبة أكبر من 1. ما العدد التالي؟",
      "choices": [
        "3",
        "4",
        "6",
        "8"
      ],
      "answer": 2,
      "why": "فرق المواضع الفردية -1، ونسبة الزوجية 2؛ المطلوب من المواضع الفردية، وبعد 7 يأتي 6 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0124",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "216، 343، 512، ؟ الحدود مكعبات أعداد صحيحة موجبة تتحرك بخطوة ثابتة غير صفرية. ما العدد التالي؟",
      "choices": [
        "729",
        "730",
        "1331",
        "1728"
      ],
      "answer": 0,
      "why": "الجذور التكعيبية الموجبة هي 6، 7، 8، وخطوتها 1؛ التالي 9، و9³ = 729.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0125",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "19، 57، 171، ؟ نسبة كل حد إلى سابقه ثابتة وأكبر من 1. ما العدد التالي؟",
      "choices": [
        "342",
        "513",
        "684",
        "855"
      ],
      "answer": 1,
      "why": "كل حد ناتج ضرب سابقه في 3؛ إذن 171 × 3 = 513.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0126",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "2، 3، 5، 8، 13، 21، ؟ من الحد الثالث، كل حد يساوي مجموع الحدين السابقين. ما العدد التالي؟",
      "choices": [
        "26",
        "34",
        "39",
        "42"
      ],
      "answer": 1,
      "why": "نجمع الحدين الأخيرين: 13 + 21 = 34.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0127",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "8، 21، 12، 26، 16، 31، 20، ؟ المواضع الفردية متتالية حسابية، والمواضع الزوجية متتالية حسابية أخرى؛ والفرق في كل منهما غير صفري. ما العدد التالي؟",
      "choices": [
        "36",
        "41",
        "46",
        "51"
      ],
      "answer": 0,
      "why": "فرق المواضع الفردية 4، وفرق الزوجية 5؛ المطلوب من المواضع الزوجية، وبعد 31 يأتي 36 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0128",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "306، 102، 108، 36، 42، ؟ تتناوب عمليتا القسمة على عدد صحيح ثابت أكبر من 1 والجمع مع عدد صحيح ثابت غير صفري، بدءا بالقسمة. ما العدد التالي؟",
      "choices": [
        "8",
        "12",
        "13",
        "14"
      ],
      "answer": 3,
      "why": "تتناوب القسمة على 3 وإضافة 6؛ الدور الآن للقسمة: 42 ÷ 3 = 14.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0129",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "8، 13، 28، 73، 208، ؟ الفروق بين الحدود المتجاورة موجبة، ونسبة كل فرق إلى سابقه عدد صحيح ثابت أكبر من 1. ما العدد التالي؟",
      "choices": [
        "343",
        "478",
        "613",
        "883"
      ],
      "answer": 2,
      "why": "الفروق هي 5، 15، 45، 135، ونسبتها 3؛ الفرق التالي 405، فيكون 208 + 405 = 613.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0130",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "10، 14، 11، 9، 13، 10، 8، ؟ الفروق تتكرر في دورة من ثلاث قيم ثابتة مختلفة غير صفرية، بالترتيب نفسه. ما العدد التالي؟",
      "choices": [
        "8",
        "11",
        "12",
        "13"
      ],
      "answer": 2,
      "why": "الفروق تتكرر بالترتيب 4، -3، -2؛ الدور الآن لإضافة 4، لذلك 8 + 4 = 12.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0131",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "9، 22، 14، 25، 19، 28، ؟ المواضع الفردية متتالية حسابية، والمواضع الزوجية متتالية حسابية أخرى؛ والفرق في كل منهما غير صفري. ما العدد التالي؟",
      "choices": [
        "9",
        "14",
        "24",
        "34"
      ],
      "answer": 2,
      "why": "فرق المواضع الفردية 5، وفرق الزوجية 3؛ المطلوب من المواضع الفردية، وبعد 19 يأتي 24 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0132",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "11، 21، 15، 26، 19، 31، ؟ المواضع الفردية متتالية حسابية، والمواضع الزوجية متتالية حسابية أخرى؛ والفرق في كل منهما غير صفري. ما العدد التالي؟",
      "choices": [
        "11",
        "15",
        "23",
        "35"
      ],
      "answer": 2,
      "why": "فرق المواضع الفردية 4، وفرق الزوجية 5؛ المطلوب من المواضع الفردية، وبعد 19 يأتي 23 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0133",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "24، 27، 35، 38، 46، ؟ الفروق بين الحدود المتجاورة تتناوب بين قيمتين ثابتتين مختلفتين غير صفريتين. ما العدد التالي؟",
      "choices": [
        "46",
        "49",
        "52",
        "54"
      ],
      "answer": 1,
      "why": "الفروق تتناوب بين 3 و8؛ الدور الآن لإضافة 3، لذلك 46 + 3 = 49.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0134",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "10، 18، 20، 28، 30، ؟ الفروق بين الحدود المتجاورة تتناوب بين قيمتين ثابتتين مختلفتين غير صفريتين. ما العدد التالي؟",
      "choices": [
        "22",
        "30",
        "32",
        "38"
      ],
      "answer": 3,
      "why": "الفروق تتناوب بين 8 و2؛ الدور الآن لإضافة 8، لذلك 30 + 8 = 38.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0135",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "13، 8، 11، 24، 9، 72، ؟ المواضع الفردية متتالية حسابية بفرق غير صفري، والمواضع الزوجية متتالية هندسية بنسبة أكبر من 1. ما العدد التالي؟",
      "choices": [
        "1",
        "3",
        "6",
        "7"
      ],
      "answer": 3,
      "why": "فرق المواضع الفردية -2، ونسبة الزوجية 3؛ المطلوب من المواضع الفردية، وبعد 9 يأتي 7 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0136",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "5، 11، 21، 35، 53، ؟ الفروق بين الحدود المتجاورة تتغير بمقدار ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "63",
        "67",
        "75",
        "83"
      ],
      "answer": 2,
      "why": "الفروق هي 6، 10، 14، 18، وتتغير بمقدار 4؛ الفرق التالي 22، فيكون 53 + 22 = 75.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0137",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "41، 43، 47، 53، ؟ الحدود أعداد أولية متتالية تصاعديا. ما العدد التالي؟",
      "choices": [
        "43",
        "47",
        "59",
        "67"
      ],
      "answer": 2,
      "why": "الأعداد المعروضة أولية متتالية؛ أول عدد أولي بعد 53 هو 59.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0138",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "ظ، غ، ق، ل، ؟ الحروف تتحرك بخطوة ثابتة غير صفرية في الترتيب الهجائي العربي المعتاد، من دون التفاف عند طرفيه. ما الحرف التالي؟",
      "choices": [
        "م",
        "ي",
        "ن",
        "ه"
      ],
      "answer": 2,
      "why": "مواضع الحروف هي 17، 19، 21، 23، وخطوتها 2؛ الموضع التالي 25 وحرفه ن.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0139",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "3، 5، 8، 13، 21، 34، ؟ من الحد الثالث، كل حد يساوي مجموع الحدين السابقين. ما العدد التالي؟",
      "choices": [
        "42",
        "55",
        "63",
        "68"
      ],
      "answer": 1,
      "why": "نجمع الحدين الأخيرين: 21 + 34 = 55.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0140",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "ع، ص، ر، ح، ؟ الحروف تتحرك بخطوة ثابتة غير صفرية في الترتيب الهجائي العربي المعتاد، من دون التفاف عند طرفيه. ما الحرف التالي؟",
      "choices": [
        "ت",
        "ج",
        "ح",
        "ب"
      ],
      "answer": 3,
      "why": "مواضع الحروف هي 18، 14، 10، 6، وخطوتها -4؛ الموضع التالي 2 وحرفه ب.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0141",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "54، 27، 30، 15، 18، ؟ تتناوب عمليتا القسمة على عدد صحيح ثابت أكبر من 1 والجمع مع عدد صحيح ثابت غير صفري، بدءا بالقسمة. ما العدد التالي؟",
      "choices": [
        "6",
        "7",
        "8",
        "9"
      ],
      "answer": 3,
      "why": "تتناوب القسمة على 2 وإضافة 3؛ الدور الآن للقسمة: 18 ÷ 2 = 9.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0142",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "83، 70، 57، 44، ؟ الفروق بين الحدود المتجاورة ثابتة وسالبة. ما العدد التالي؟",
      "choices": [
        "5",
        "18",
        "31",
        "70"
      ],
      "answer": 2,
      "why": "الفرق الثابت هو -13؛ لذلك 44 − 13 = 31.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0143",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "7، 9، 12، 27، 17، 81، 22، ؟ المواضع الفردية متتالية حسابية بفرق غير صفري، والمواضع الزوجية متتالية هندسية بنسبة أكبر من 1. ما العدد التالي؟",
      "choices": [
        "9",
        "27",
        "243",
        "729"
      ],
      "answer": 2,
      "why": "فرق المواضع الفردية 5، ونسبة الزوجية 3؛ المطلوب من المواضع الزوجية، وبعد 81 يأتي 243 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0145",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "14، 15، 15، 17، 16، 19، 17، ؟ المواضع الفردية متتالية حسابية، والمواضع الزوجية متتالية حسابية أخرى؛ والفرق في كل منهما غير صفري. ما العدد التالي؟",
      "choices": [
        "15",
        "21",
        "23",
        "25"
      ],
      "answer": 1,
      "why": "فرق المواضع الفردية 1، وفرق الزوجية 2؛ المطلوب من المواضع الزوجية، وبعد 19 يأتي 21 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0146",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "12، 13، 15، 19، 27، ؟ الفروق بين الحدود المتجاورة موجبة، ونسبة كل فرق إلى سابقه عدد صحيح ثابت أكبر من 1. ما العدد التالي؟",
      "choices": [
        "35",
        "41",
        "42",
        "43"
      ],
      "answer": 3,
      "why": "الفروق هي 1، 2، 4، 8، ونسبتها 2؛ الفرق التالي 16، فيكون 27 + 16 = 43.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0147",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "4، 8، 15، 10، 20، 27، 22، ؟ تتكرر دورة: الضرب في عدد صحيح ثابت أكبر من 1، ثم إضافة عدد صحيح موجب ثابت، ثم طرح عدد صحيح موجب ثابت مختلف عنه. ما العدد التالي؟",
      "choices": [
        "43",
        "44",
        "45",
        "46"
      ],
      "answer": 1,
      "why": "الدورة هي ×2، ثم +7، ثم −5؛ العملية التالية الضرب في 2، وناتجها 44.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0148",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "875، 175، 35، ؟ نسبة كل حد إلى سابقه ثابتة وبين 0 و1. ما العدد التالي؟",
      "choices": [
        "5",
        "7",
        "12",
        "30"
      ],
      "answer": 1,
      "why": "كل حد ناتج قسمة سابقه على 5؛ إذن 35 ÷ 5 = 7.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0149",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "6، 12، 17، 34، 39، ؟ تتناوب عمليتا الضرب في عدد صحيح ثابت أكبر من 1 والجمع مع عدد صحيح ثابت غير صفري، بدءا بالضرب. ما العدد التالي؟",
      "choices": [
        "39",
        "44",
        "73",
        "78"
      ],
      "answer": 3,
      "why": "تتناوب عمليتا الضرب في 2 وإضافة 5؛ الدور الآن للضرب، لذلك 39 × 2 = 78.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0150",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "14، 19، 29، 49، 89، ؟ الفروق بين الحدود المتجاورة موجبة، ونسبة كل فرق إلى سابقه عدد صحيح ثابت أكبر من 1. ما العدد التالي؟",
      "choices": [
        "129",
        "167",
        "168",
        "169"
      ],
      "answer": 3,
      "why": "الفروق هي 5، 10، 20، 40، ونسبتها 2؛ الفرق التالي 80، فيكون 89 + 80 = 169.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0151",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "7، 9، 16، 28، 45، ؟ الفروق بين الحدود المتجاورة تتغير بمقدار ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "67",
        "72",
        "77",
        "82"
      ],
      "answer": 0,
      "why": "الفروق هي 2، 7، 12، 17، وتتغير بمقدار 5؛ الفرق التالي 22، فيكون 45 + 22 = 67.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0152",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "19، 23، 29، 31، ؟ الحدود أعداد أولية متتالية تصاعديا. ما العدد التالي؟",
      "choices": [
        "23",
        "29",
        "36",
        "37"
      ],
      "answer": 3,
      "why": "الأعداد المعروضة أولية متتالية؛ أول عدد أولي بعد 31 هو 37.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0153",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "7، 9، 16، 25، 41، 66، ؟ من الحد الثالث، كل حد يساوي مجموع الحدين السابقين. ما العدد التالي؟",
      "choices": [
        "107",
        "123",
        "132",
        "189"
      ],
      "answer": 0,
      "why": "نجمع الحدين الأخيرين: 41 + 66 = 107.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0154",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "120، 136، 153، 171، ؟ الحدود أعداد مثلثية متتالية بخطوة ثابتة في ترتيبها؛ والعدد المثلثي هو مجموع الأعداد من 1 إلى عدد صحيح موجب. ما العدد التالي؟",
      "choices": [
        "153",
        "190",
        "231",
        "253"
      ],
      "answer": 1,
      "why": "ترتيب الأعداد المثلثية المعروضة هو 15، 16، 17، 18؛ التالي في الترتيب 19، وقيمته 19 × 20 ÷ 2 = 190.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0156",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "25، 34، 50، 75، ؟ الفروق بين الحدود المتجاورة مربعات أعداد صحيحة موجبة متتالية تصاعديا. ما العدد التالي؟",
      "choices": [
        "111",
        "117",
        "139",
        "156"
      ],
      "answer": 0,
      "why": "الفروق 9، 16، 25 هي مربعات 3، 4، 5؛ التالي 6² = 36، ثم 75 + 36 = 111.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0157",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "3، 9، 16، 10، 30، 37، 31، 93، ؟ تتكرر دورة: الضرب في عدد صحيح ثابت أكبر من 1، ثم إضافة عدد صحيح موجب ثابت، ثم طرح عدد صحيح موجب ثابت مختلف عنه. ما العدد التالي؟",
      "choices": [
        "87",
        "93",
        "99",
        "100"
      ],
      "answer": 3,
      "why": "الدورة هي ×3، ثم +7، ثم −6؛ العملية التالية إضافة 7، وناتجها 100.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0158",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "9، 11، 17، 35، 89، ؟ الفروق بين الحدود المتجاورة موجبة، ونسبة كل فرق إلى سابقه عدد صحيح ثابت أكبر من 1. ما العدد التالي؟",
      "choices": [
        "143",
        "197",
        "250",
        "251"
      ],
      "answer": 3,
      "why": "الفروق هي 2، 6، 18، 54، ونسبتها 3؛ الفرق التالي 162، فيكون 89 + 162 = 251.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0159",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "17، 21، 23، 27، 29، ؟ الفروق بين الحدود المتجاورة تتناوب بين قيمتين ثابتتين مختلفتين غير صفريتين. ما العدد التالي؟",
      "choices": [
        "25",
        "29",
        "31",
        "33"
      ],
      "answer": 3,
      "why": "الفروق تتناوب بين 4 و2؛ الدور الآن لإضافة 4، لذلك 29 + 4 = 33.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0160",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "24، 25، 20، 21، 16، 17، ؟ الفروق بين الحدود المتجاورة تتناوب بين قيمتين ثابتتين مختلفتين غير صفريتين. ما العدد التالي؟",
      "choices": [
        "7",
        "10",
        "11",
        "12"
      ],
      "answer": 3,
      "why": "الفروق تتناوب بين 1 و-5؛ الدور الآن لإضافة -5، لذلك 17 − 5 = 12.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0162",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "8، 27، 84، 255، ؟ كل حد يساوي سابقه مضروبا في عدد صحيح ثابت أكبر من 1، ثم مضافا إليه عدد صحيح ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "513",
        "516",
        "768",
        "1020"
      ],
      "answer": 2,
      "why": "في كل انتقال نضرب في 3 ثم نضيف 3؛ لذلك 3 × 255 + 3 = 768.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0163",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "336، 168، 84، 42، ؟ نسبة كل حد إلى سابقه ثابتة وبين 0 و1. ما العدد التالي؟",
      "choices": [
        "7",
        "14",
        "21",
        "23"
      ],
      "answer": 2,
      "why": "كل حد ناتج قسمة سابقه على 2؛ إذن 42 ÷ 2 = 21.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0165",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "3، 4، 11، 26، 63، ؟ من الحد الثالث، كل حد يساوي حاصل ضرب سابقه في 2، مضافا إليه ما قبله. ما العدد التالي؟",
      "choices": [
        "115",
        "141",
        "152",
        "189"
      ],
      "answer": 2,
      "why": "نضرب الحد الأخير في 2 ثم نضيف ما قبله: 2 × 63 + 26 = 152.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0166",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "3، 21، 9، 42، 27، 84، ؟ المواضع الفردية متتالية هندسية، والمواضع الزوجية متتالية هندسية أخرى؛ والنسبة في كل منهما أكبر من 1. ما العدد التالي؟",
      "choices": [
        "9",
        "81",
        "243",
        "729"
      ],
      "answer": 1,
      "why": "نسبة المواضع الفردية 3، ونسبة الزوجية 2؛ المطلوب من المواضع الفردية، وبعد 27 يأتي 81 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0167",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "6، 12، 18، 16، 32، 38، 36، ؟ تتكرر دورة: الضرب في عدد صحيح ثابت أكبر من 1، ثم إضافة عدد صحيح موجب ثابت، ثم طرح عدد صحيح موجب ثابت مختلف عنه. ما العدد التالي؟",
      "choices": [
        "36",
        "42",
        "71",
        "72"
      ],
      "answer": 3,
      "why": "الدورة هي ×2، ثم +6، ثم −2؛ العملية التالية الضرب في 2، وناتجها 72.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0168",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "8، 16، 24، 48، 56، ؟ تتناوب عمليتا الضرب في عدد صحيح ثابت أكبر من 1 والجمع مع عدد صحيح ثابت غير صفري، بدءا بالضرب. ما العدد التالي؟",
      "choices": [
        "56",
        "64",
        "104",
        "112"
      ],
      "answer": 3,
      "why": "تتناوب عمليتا الضرب في 2 وإضافة 8؛ الدور الآن للضرب، لذلك 56 × 2 = 112.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0169",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "21، 58، 119، ؟ الحدود مكعبات أعداد صحيحة موجبة متتالية تصاعديا، أضيف إليها عدد صحيح ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "210",
        "216",
        "506",
        "723"
      ],
      "answer": 0,
      "why": "الحدود هي المكعبات ابتداء من 3³ مع إضافة -6؛ لذلك التالي 6³ − 6 = 210.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0170",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "78، 91، 105، 120، ؟ الحدود أعداد مثلثية متتالية بخطوة ثابتة في ترتيبها؛ والعدد المثلثي هو مجموع الأعداد من 1 إلى عدد صحيح موجب. ما العدد التالي؟",
      "choices": [
        "105",
        "136",
        "171",
        "190"
      ],
      "answer": 1,
      "why": "ترتيب الأعداد المثلثية المعروضة هو 12، 13، 14، 15؛ التالي في الترتيب 16، وقيمته 16 × 17 ÷ 2 = 136.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0172",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "9، 23، 13، 28، 17، 33، 21، ؟ المواضع الفردية متتالية حسابية، والمواضع الزوجية متتالية حسابية أخرى؛ والفرق في كل منهما غير صفري. ما العدد التالي؟",
      "choices": [
        "23",
        "28",
        "38",
        "43"
      ],
      "answer": 2,
      "why": "فرق المواضع الفردية 4، وفرق الزوجية 5؛ المطلوب من المواضع الزوجية، وبعد 33 يأتي 38 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0173",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "الخميس، الاثنين، الجمعة، الثلاثاء، ؟ الأيام تسير إلى الأمام بخطوة ثابتة من 1 إلى 6 أيام، مع العودة بعد الجمعة إلى السبت. ما اليوم التالي؟",
      "choices": [
        "الاثنين",
        "السبت",
        "الجمعة",
        "الأحد"
      ],
      "answer": 1,
      "why": "نتقدم 4 أيام في كل انتقال؛ من الثلاثاء نصل إلى السبت مع دوران الأسبوع.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0174",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "5، 2، 3، 10، 15، 28، ؟ من الحد الرابع، كل حد يساوي مجموع الحدود الثلاثة السابقة مباشرة. ما العدد التالي؟",
      "choices": [
        "25",
        "38",
        "53",
        "68"
      ],
      "answer": 2,
      "why": "نجمع آخر ثلاثة حدود: 10 + 15 + 28 = 53.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0175",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "4، 12، 7، 24، 10، 48، ؟ المواضع الفردية متتالية حسابية بفرق غير صفري، والمواضع الزوجية متتالية هندسية بنسبة أكبر من 1. ما العدد التالي؟",
      "choices": [
        "7",
        "13",
        "19",
        "22"
      ],
      "answer": 1,
      "why": "فرق المواضع الفردية 3، ونسبة الزوجية 2؛ المطلوب من المواضع الفردية، وبعد 10 يأتي 13 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0177",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "3، 6، 13، 11، 22، 29، 27، ؟ تتكرر دورة: الضرب في عدد صحيح ثابت أكبر من 1، ثم إضافة عدد صحيح موجب ثابت، ثم طرح عدد صحيح موجب ثابت مختلف عنه. ما العدد التالي؟",
      "choices": [
        "54",
        "55",
        "56",
        "57"
      ],
      "answer": 0,
      "why": "الدورة هي ×2، ثم +7، ثم −2؛ العملية التالية الضرب في 2، وناتجها 54.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0178",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "13، 19، 31، 55، 103، ؟ الفروق بين الحدود المتجاورة موجبة، ونسبة كل فرق إلى سابقه عدد صحيح ثابت أكبر من 1. ما العدد التالي؟",
      "choices": [
        "151",
        "198",
        "199",
        "295"
      ],
      "answer": 2,
      "why": "الفروق هي 6، 12، 24، 48، ونسبتها 2؛ الفرق التالي 96، فيكون 103 + 96 = 199.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0179",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "66، 55، 45، 36، ؟ الحدود أعداد مثلثية متتالية بخطوة ثابتة في ترتيبها؛ والعدد المثلثي هو مجموع الأعداد من 1 إلى عدد صحيح موجب. ما العدد التالي؟",
      "choices": [
        "10",
        "15",
        "28",
        "45"
      ],
      "answer": 2,
      "why": "ترتيب الأعداد المثلثية المعروضة هو 11، 10، 9، 8؛ التالي في الترتيب 7، وقيمته 7 × 8 ÷ 2 = 28.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0180",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "304، 152، 76، 38، ؟ نسبة كل حد إلى سابقه ثابتة وبين 0 و1. ما العدد التالي؟",
      "choices": [
        "16",
        "17",
        "18",
        "19"
      ],
      "answer": 3,
      "why": "كل حد ناتج قسمة سابقه على 2؛ إذن 38 ÷ 2 = 19.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0181",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "9، 12، 18، 30، ؟ كل حد يساوي سابقه مضروبا في عدد صحيح ثابت أكبر من 1، ثم مضافا إليه عدد صحيح ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "30",
        "54",
        "78",
        "84"
      ],
      "answer": 1,
      "why": "في كل انتقال نضرب في 2 ثم نضيف -6؛ لذلك 2 × 30 − 6 = 54.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0182",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "91، 105، 120، 136، ؟ الحدود أعداد مثلثية متتالية بخطوة ثابتة في ترتيبها؛ والعدد المثلثي هو مجموع الأعداد من 1 إلى عدد صحيح موجب. ما العدد التالي؟",
      "choices": [
        "120",
        "153",
        "190",
        "210"
      ],
      "answer": 1,
      "why": "ترتيب الأعداد المثلثية المعروضة هو 13، 14، 15، 16؛ التالي في الترتيب 17، وقيمته 17 × 18 ÷ 2 = 153.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0183",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "7، 19، 13، 57، 19، 171، ؟ المواضع الفردية متتالية حسابية بفرق غير صفري، والمواضع الزوجية متتالية هندسية بنسبة أكبر من 1. ما العدد التالي؟",
      "choices": [
        "7",
        "13",
        "24",
        "25"
      ],
      "answer": 3,
      "why": "فرق المواضع الفردية 6، ونسبة الزوجية 3؛ المطلوب من المواضع الفردية، وبعد 19 يأتي 25 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0184",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "18، 19، 14، 15، 10، ؟ الفروق بين الحدود المتجاورة تتناوب بين قيمتين ثابتتين مختلفتين غير صفريتين. ما العدد التالي؟",
      "choices": [
        "5",
        "9",
        "10",
        "11"
      ],
      "answer": 3,
      "why": "الفروق تتناوب بين 1 و-5؛ الدور الآن لإضافة 1، لذلك 10 + 1 = 11.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0185",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "17، 51، 153، ؟ نسبة كل حد إلى سابقه ثابتة وأكبر من 1. ما العدد التالي؟",
      "choices": [
        "306",
        "459",
        "612",
        "765"
      ],
      "answer": 1,
      "why": "كل حد ناتج ضرب سابقه في 3؛ إذن 153 × 3 = 459.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0186",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "8، 10، 14، 22، ؟ كل حد يساوي سابقه مضروبا في عدد صحيح ثابت أكبر من 1، ثم مضافا إليه عدد صحيح ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "10",
        "22",
        "36",
        "38"
      ],
      "answer": 3,
      "why": "في كل انتقال نضرب في 2 ثم نضيف -6؛ لذلك 2 × 22 − 6 = 38.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0187",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "الخميس، الجمعة، السبت، الأحد، ؟ الأيام تسير إلى الأمام بخطوة ثابتة من 1 إلى 6 أيام، مع العودة بعد الجمعة إلى السبت. ما اليوم التالي؟",
      "choices": [
        "السبت",
        "الجمعة",
        "الاثنين",
        "الأحد"
      ],
      "answer": 2,
      "why": "نتقدم يوما واحدا في كل انتقال؛ من الأحد نصل إلى الاثنين مع دوران الأسبوع.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0188",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "169، 3، 196، 5، 225، 7، ؟ المواضع الفردية مربعات أعداد صحيحة موجبة متتالية تصاعديا، والمواضع الزوجية متتالية حسابية بفرق غير صفري. ما العدد التالي؟",
      "choices": [
        "169",
        "196",
        "256",
        "289"
      ],
      "answer": 2,
      "why": "المواضع الفردية مربعات 13، 14، 15، وفرق الزوجية 2؛ المطلوب من المواضع الفردية، وبعد 225 يأتي 256 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0189",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "7، 13، 19، 29، ؟ الحدود أعداد أولية تصاعديا؛ يؤخذ عدد أولي ويترك الذي يليه، ويتكرر ذلك. ما العدد التالي؟",
      "choices": [
        "23",
        "31",
        "36",
        "37"
      ],
      "answer": 3,
      "why": "بعد 29 يأتي الأولي 31 فنتركه، ثم نأخذ 37، مع استمرار أخذ أولي وترك الذي يليه.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0190",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "ج، ذ، ش، ظ، ؟ الحروف تتحرك بخطوة ثابتة غير صفرية في الترتيب الهجائي العربي المعتاد، من دون التفاف عند طرفيه. ما الحرف التالي؟",
      "choices": [
        "م",
        "ق",
        "ك",
        "ظ"
      ],
      "answer": 1,
      "why": "مواضع الحروف هي 5، 9، 13، 17، وخطوتها 4؛ الموضع التالي 21 وحرفه ق.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0191",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "10، 14، 9، 13، 8، 12، ؟ الفروق بين الحدود المتجاورة تتناوب بين قيمتين ثابتتين مختلفتين غير صفريتين. ما العدد التالي؟",
      "choices": [
        "2",
        "6",
        "7",
        "12"
      ],
      "answer": 2,
      "why": "الفروق تتناوب بين 4 و-5؛ الدور الآن لإضافة -5، لذلك 12 − 5 = 7.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0193",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "512، 128، 32، ؟ نسبة كل حد إلى سابقه ثابتة وبين 0 و1. ما العدد التالي؟",
      "choices": [
        "4",
        "6",
        "7",
        "8"
      ],
      "answer": 3,
      "why": "كل حد ناتج قسمة سابقه على 4؛ إذن 32 ÷ 4 = 8.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0194",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "1، 6، 7، 13، 20، 33، ؟ من الحد الثالث، كل حد يساوي مجموع الحدين السابقين. ما العدد التالي؟",
      "choices": [
        "40",
        "53",
        "60",
        "66"
      ],
      "answer": 1,
      "why": "نجمع الحدين الأخيرين: 20 + 33 = 53.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0195",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "1375، 275، 55، ؟ نسبة كل حد إلى سابقه ثابتة وبين 0 و1. ما العدد التالي؟",
      "choices": [
        "11",
        "16",
        "50",
        "55"
      ],
      "answer": 0,
      "why": "كل حد ناتج قسمة سابقه على 5؛ إذن 55 ÷ 5 = 11.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0196",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "169، 144، 121، 100، ؟ الحدود مربعات أعداد صحيحة موجبة تتحرك بخطوة ثابتة غير صفرية. ما العدد التالي؟",
      "choices": [
        "49",
        "81",
        "121",
        "144"
      ],
      "answer": 1,
      "why": "الجذور التربيعية الموجبة هي 13، 12، 11، 10، وخطوتها -1؛ التالي 9، و9² = 81.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0198",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "الثلاثاء، السبت، الأربعاء، الأحد، ؟ الأيام تسير إلى الأمام بخطوة ثابتة من 1 إلى 6 أيام، مع العودة بعد الجمعة إلى السبت. ما اليوم التالي؟",
      "choices": [
        "الخميس",
        "الاثنين",
        "الثلاثاء",
        "الجمعة"
      ],
      "answer": 0,
      "why": "نتقدم 4 أيام في كل انتقال؛ من الأحد نصل إلى الخميس مع دوران الأسبوع.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0199",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "11، 12، 20، 47، ؟ الفروق بين الحدود المتجاورة مكعبات أعداد صحيحة موجبة متتالية تصاعديا. ما العدد التالي؟",
      "choices": [
        "111",
        "115",
        "263",
        "390"
      ],
      "answer": 0,
      "why": "الفروق 1، 8، 27 هي مكعبات 1، 2، 3؛ التالي 4³ = 64، ثم 47 + 64 = 111.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0200",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "5، 8، 14، 26، 50، ؟ الفروق بين الحدود المتجاورة موجبة، ونسبة كل فرق إلى سابقه عدد صحيح ثابت أكبر من 1. ما العدد التالي؟",
      "choices": [
        "74",
        "96",
        "97",
        "98"
      ],
      "answer": 3,
      "why": "الفروق هي 3، 6، 12، 24، ونسبتها 2؛ الفرق التالي 48، فيكون 50 + 48 = 98.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0201",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "21، 25، 27، 30، 34، 36، 39، 43، 45، ؟ الفروق تتكرر في دورة من ثلاث قيم ثابتة مختلفة غير صفرية، بالترتيب نفسه. ما العدد التالي؟",
      "choices": [
        "45",
        "47",
        "48",
        "49"
      ],
      "answer": 2,
      "why": "الفروق تتكرر بالترتيب 4، 2، 3؛ الدور الآن لإضافة 3، لذلك 45 + 3 = 48.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0202",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "6، 12، 16، 32، 36، ؟ تتناوب عمليتا الضرب في عدد صحيح ثابت أكبر من 1 والجمع مع عدد صحيح ثابت غير صفري، بدءا بالضرب. ما العدد التالي؟",
      "choices": [
        "72",
        "73",
        "74",
        "76"
      ],
      "answer": 0,
      "why": "تتناوب عمليتا الضرب في 2 وإضافة 4؛ الدور الآن للضرب، لذلك 36 × 2 = 72.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0203",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "324، 225، 144، 81، ؟ الحدود مربعات أعداد صحيحة موجبة تتحرك بخطوة ثابتة غير صفرية. ما العدد التالي؟",
      "choices": [
        "16",
        "36",
        "39",
        "64"
      ],
      "answer": 1,
      "why": "الجذور التربيعية الموجبة هي 18، 15، 12، 9، وخطوتها -3؛ التالي 6، و6² = 36.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0204",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "9، 19، 18، 57، 36، 171، ؟ المواضع الفردية متتالية هندسية، والمواضع الزوجية متتالية هندسية أخرى؛ والنسبة في كل منهما أكبر من 1. ما العدد التالي؟",
      "choices": [
        "72",
        "144",
        "288",
        "576"
      ],
      "answer": 0,
      "why": "نسبة المواضع الفردية 2، ونسبة الزوجية 3؛ المطلوب من المواضع الفردية، وبعد 36 يأتي 72 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0205",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "30، 28، 26، 24، ؟ الفروق بين الحدود المتجاورة ثابتة وسالبة. ما العدد التالي؟",
      "choices": [
        "18",
        "22",
        "24",
        "28"
      ],
      "answer": 1,
      "why": "الفرق الثابت هو -2؛ لذلك 24 − 2 = 22.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0206",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "1000، 729، 512، ؟ الحدود مكعبات أعداد صحيحة موجبة تتحرك بخطوة ثابتة غير صفرية. ما العدد التالي؟",
      "choices": [
        "343",
        "344",
        "729",
        "1000"
      ],
      "answer": 0,
      "why": "الجذور التكعيبية الموجبة هي 10، 9، 8، وخطوتها -1؛ التالي 7، و7³ = 343.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0207",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "4، 8، 12، 24، 28، 56، ؟ تتناوب عمليتا الضرب في عدد صحيح ثابت أكبر من 1 والجمع مع عدد صحيح ثابت غير صفري، بدءا بالضرب. ما العدد التالي؟",
      "choices": [
        "60",
        "62",
        "64",
        "112"
      ],
      "answer": 0,
      "why": "تتناوب عمليتا الضرب في 2 وإضافة 4؛ الدور الآن للجمع، لذلك 56 + 4 = 60.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0208",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "6، 4، 5، 15، 24، 44، ؟ من الحد الرابع، كل حد يساوي مجموع الحدود الثلاثة السابقة مباشرة. ما العدد التالي؟",
      "choices": [
        "39",
        "59",
        "83",
        "107"
      ],
      "answer": 2,
      "why": "نجمع آخر ثلاثة حدود: 15 + 24 + 44 = 83.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0209",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "95، 79، 63، 47، ؟ الفروق بين الحدود المتجاورة ثابتة وسالبة. ما العدد التالي؟",
      "choices": [
        "31",
        "47",
        "63",
        "79"
      ],
      "answer": 0,
      "why": "الفرق الثابت هو -16؛ لذلك 47 − 16 = 31.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0210",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "576، 144، 36، ؟ نسبة كل حد إلى سابقه ثابتة وبين 0 و1. ما العدد التالي؟",
      "choices": [
        "6",
        "9",
        "12",
        "18"
      ],
      "answer": 1,
      "why": "كل حد ناتج قسمة سابقه على 4؛ إذن 36 ÷ 4 = 9.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0211",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "11، 27، 59، 123، ؟ كل حد يساوي سابقه مضروبا في عدد صحيح ثابت أكبر من 1، ثم مضافا إليه عدد صحيح ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "133",
        "251",
        "369",
        "374"
      ],
      "answer": 1,
      "why": "في كل انتقال نضرب في 2 ثم نضيف 5؛ لذلك 2 × 123 + 5 = 251.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0212",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "7، 14، 18، 13، 26، 30، 25، 50، ؟ تتكرر دورة: الضرب في عدد صحيح ثابت أكبر من 1، ثم إضافة عدد صحيح موجب ثابت، ثم طرح عدد صحيح موجب ثابت مختلف عنه. ما العدد التالي؟",
      "choices": [
        "45",
        "50",
        "53",
        "54"
      ],
      "answer": 3,
      "why": "الدورة هي ×2، ثم +4، ثم −5؛ العملية التالية إضافة 4، وناتجها 54.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0213",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "2، 6، 1، 9، 16، 26، ؟ من الحد الرابع، كل حد يساوي مجموع الحدود الثلاثة السابقة مباشرة. ما العدد التالي؟",
      "choices": [
        "25",
        "35",
        "51",
        "67"
      ],
      "answer": 2,
      "why": "نجمع آخر ثلاثة حدود: 9 + 16 + 26 = 51.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0214",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "49، 4، 64، 8، 81، 12، 100، ؟ المواضع الفردية مربعات أعداد صحيحة موجبة متتالية تصاعديا، والمواضع الزوجية متتالية حسابية بفرق غير صفري. ما العدد التالي؟",
      "choices": [
        "4",
        "8",
        "16",
        "24"
      ],
      "answer": 2,
      "why": "المواضع الفردية مربعات 7، 8، 9، 10، وفرق الزوجية 4؛ المطلوب من المواضع الزوجية، وبعد 12 يأتي 16 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0215",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "15، 40، 76، 125، ؟ الفروق بين الحدود المتجاورة مربعات أعداد صحيحة موجبة متتالية تصاعديا. ما العدد التالي؟",
      "choices": [
        "150",
        "161",
        "189",
        "225"
      ],
      "answer": 2,
      "why": "الفروق 25، 36، 49 هي مربعات 5، 6، 7؛ التالي 8² = 64، ثم 125 + 64 = 189.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0216",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "11، 14، 9، 12، 7، 10، ؟ الفروق بين الحدود المتجاورة تتناوب بين قيمتين ثابتتين مختلفتين غير صفريتين. ما العدد التالي؟",
      "choices": [
        "0",
        "3",
        "4",
        "5"
      ],
      "answer": 3,
      "why": "الفروق تتناوب بين 3 و-5؛ الدور الآن لإضافة -5، لذلك 10 − 5 = 5.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0218",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "5، 24، 15، 48، 45، 96، 135، ؟ المواضع الفردية متتالية هندسية، والمواضع الزوجية متتالية هندسية أخرى؛ والنسبة في كل منهما أكبر من 1. ما العدد التالي؟",
      "choices": [
        "48",
        "192",
        "384",
        "768"
      ],
      "answer": 1,
      "why": "نسبة المواضع الفردية 3، ونسبة الزوجية 2؛ المطلوب من المواضع الزوجية، وبعد 96 يأتي 192 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0219",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "11، 17، 23، 31، ؟ الحدود أعداد أولية تصاعديا؛ يؤخذ عدد أولي ويترك الذي يليه، ويتكرر ذلك. ما العدد التالي؟",
      "choices": [
        "29",
        "41",
        "47",
        "53"
      ],
      "answer": 1,
      "why": "بعد 31 يأتي الأولي 37 فنتركه، ثم نأخذ 41، مع استمرار أخذ أولي وترك الذي يليه.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0220",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "11، 13، 10، 8، 10، 7، 5، ؟ الفروق تتكرر في دورة من ثلاث قيم ثابتة مختلفة غير صفرية، بالترتيب نفسه. ما العدد التالي؟",
      "choices": [
        "6",
        "7",
        "8",
        "9"
      ],
      "answer": 1,
      "why": "الفروق تتكرر بالترتيب 2، -3، -2؛ الدور الآن لإضافة 2، لذلك 5 + 2 = 7.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0222",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "23، 27، 33، 37، 43، ؟ الفروق بين الحدود المتجاورة تتناوب بين قيمتين ثابتتين مختلفتين غير صفريتين. ما العدد التالي؟",
      "choices": [
        "43",
        "47",
        "49",
        "51"
      ],
      "answer": 1,
      "why": "الفروق تتناوب بين 4 و6؛ الدور الآن لإضافة 4، لذلك 43 + 4 = 47.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0223",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "13، 16، 12، 18، 11، 20، ؟ المواضع الفردية متتالية حسابية، والمواضع الزوجية متتالية حسابية أخرى؛ والفرق في كل منهما غير صفري. ما العدد التالي؟",
      "choices": [
        "7",
        "8",
        "10",
        "12"
      ],
      "answer": 2,
      "why": "فرق المواضع الفردية -1، وفرق الزوجية 2؛ المطلوب من المواضع الفردية، وبعد 11 يأتي 10 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0224",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "11، 15، 12، 15، 19، 16، 19، ؟ الفروق تتكرر في دورة من ثلاث قيم ثابتة مختلفة غير صفرية، بالترتيب نفسه. ما العدد التالي؟",
      "choices": [
        "19",
        "22",
        "23",
        "24"
      ],
      "answer": 2,
      "why": "الفروق تتكرر بالترتيب 4، -3، 3؛ الدور الآن لإضافة 4، لذلك 19 + 4 = 23.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0225",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "13، 39، 117، ؟ نسبة كل حد إلى سابقه ثابتة وأكبر من 1. ما العدد التالي؟",
      "choices": [
        "156",
        "234",
        "351",
        "468"
      ],
      "answer": 2,
      "why": "كل حد ناتج ضرب سابقه في 3؛ إذن 117 × 3 = 351.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0226",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "28، 37، 53، 78، ؟ الفروق بين الحدود المتجاورة مربعات أعداد صحيحة موجبة متتالية تصاعديا. ما العدد التالي؟",
      "choices": [
        "87",
        "94",
        "114",
        "142"
      ],
      "answer": 2,
      "why": "الفروق 9، 16، 25 هي مربعات 3، 4، 5؛ التالي 6² = 36، ثم 78 + 36 = 114.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0227",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "675، 225، 75، ؟ نسبة كل حد إلى سابقه ثابتة وبين 0 و1. ما العدد التالي؟",
      "choices": [
        "15",
        "22",
        "24",
        "25"
      ],
      "answer": 3,
      "why": "كل حد ناتج قسمة سابقه على 3؛ إذن 75 ÷ 3 = 25.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0228",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "ز، ص، ظ، ف، ؟ الحروف تتحرك بخطوة ثابتة غير صفرية في الترتيب الهجائي العربي المعتاد، من دون التفاف عند طرفيه. ما الحرف التالي؟",
      "choices": [
        "ن",
        "ق",
        "غ",
        "ل"
      ],
      "answer": 3,
      "why": "مواضع الحروف هي 11، 14، 17، 20، وخطوتها 3؛ الموضع التالي 23 وحرفه ل.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0229",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "ط، ض، ص، ش، ؟ الحروف تتحرك بخطوة ثابتة غير صفرية في الترتيب الهجائي العربي المعتاد، من دون التفاف عند طرفيه. ما الحرف التالي؟",
      "choices": [
        "ر",
        "ش",
        "س",
        "ص"
      ],
      "answer": 2,
      "why": "مواضع الحروف هي 16، 15، 14، 13، وخطوتها -1؛ الموضع التالي 12 وحرفه س.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0230",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "5، 8، 11، 14، ؟ الفروق بين الحدود المتجاورة ثابتة وموجبة. ما العدد التالي؟",
      "choices": [
        "8",
        "17",
        "23",
        "26"
      ],
      "answer": 1,
      "why": "الفرق الثابت هو 3؛ لذلك 14 + 3 = 17.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0231",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "9، 25، 49، 81، ؟ الحدود مربعات أعداد صحيحة موجبة تتحرك بخطوة ثابتة غير صفرية. ما العدد التالي؟",
      "choices": [
        "121",
        "123",
        "169",
        "196"
      ],
      "answer": 0,
      "why": "الجذور التربيعية الموجبة هي 3، 5، 7، 9، وخطوتها 2؛ التالي 11، و11² = 121.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0232",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "4، 8، 13، 26، 31، ؟ تتناوب عمليتا الضرب في عدد صحيح ثابت أكبر من 1 والجمع مع عدد صحيح ثابت غير صفري، بدءا بالضرب. ما العدد التالي؟",
      "choices": [
        "31",
        "36",
        "57",
        "62"
      ],
      "answer": 3,
      "why": "تتناوب عمليتا الضرب في 2 وإضافة 5؛ الدور الآن للضرب، لذلك 31 × 2 = 62.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0233",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "6، 10، 18، 34، ؟ كل حد يساوي سابقه مضروبا في عدد صحيح ثابت أكبر من 1، ثم مضافا إليه عدد صحيح ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "66",
        "98",
        "100",
        "102"
      ],
      "answer": 0,
      "why": "في كل انتقال نضرب في 2 ثم نضيف -2؛ لذلك 2 × 34 − 2 = 66.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0234",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "11، 17، 23، 29، ؟ الفروق بين الحدود المتجاورة ثابتة وموجبة. ما العدد التالي؟",
      "choices": [
        "35",
        "41",
        "47",
        "53"
      ],
      "answer": 0,
      "why": "الفرق الثابت هو 6؛ لذلك 29 + 6 = 35.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0235",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "خ، ذ، ز، ش، ؟ الحروف تتحرك بخطوة ثابتة غير صفرية في الترتيب الهجائي العربي المعتاد، من دون التفاف عند طرفيه. ما الحرف التالي؟",
      "choices": [
        "ص",
        "س",
        "ض",
        "ش"
      ],
      "answer": 2,
      "why": "مواضع الحروف هي 7، 9، 11، 13، وخطوتها 2؛ الموضع التالي 15 وحرفه ض.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0236",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "216، 125، 64، ؟ الحدود مكعبات أعداد صحيحة موجبة تتحرك بخطوة ثابتة غير صفرية. ما العدد التالي؟",
      "choices": [
        "27",
        "28",
        "125",
        "216"
      ],
      "answer": 0,
      "why": "الجذور التكعيبية الموجبة هي 6، 5، 4، وخطوتها -1؛ التالي 3، و3³ = 27.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0237",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "19، 20، 19، 17، 18، 17، 15، ؟ الفروق تتكرر في دورة من ثلاث قيم ثابتة مختلفة غير صفرية، بالترتيب نفسه. ما العدد التالي؟",
      "choices": [
        "15",
        "16",
        "17",
        "18"
      ],
      "answer": 1,
      "why": "الفروق تتكرر بالترتيب 1، -1، -2؛ الدور الآن لإضافة 1، لذلك 15 + 1 = 16.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0238",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "1، 17، 42، 78، ؟ الفروق بين الحدود المتجاورة مربعات أعداد صحيحة موجبة متتالية تصاعديا. ما العدد التالي؟",
      "choices": [
        "94",
        "103",
        "120",
        "127"
      ],
      "answer": 3,
      "why": "الفروق 16، 25، 36 هي مربعات 4، 5، 6؛ التالي 7² = 49، ثم 78 + 49 = 127.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0241",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "11، 28، 79، 232، ؟ كل حد يساوي سابقه مضروبا في عدد صحيح ثابت أكبر من 1، ثم مضافا إليه عدد صحيح ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "459",
        "464",
        "691",
        "918"
      ],
      "answer": 2,
      "why": "في كل انتقال نضرب في 3 ثم نضيف -5؛ لذلك 3 × 232 − 5 = 691.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0242",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "15، 22، 13، 66، 11، 198، ؟ المواضع الفردية متتالية حسابية بفرق غير صفري، والمواضع الزوجية متتالية هندسية بنسبة أكبر من 1. ما العدد التالي؟",
      "choices": [
        "3",
        "5",
        "8",
        "9"
      ],
      "answer": 3,
      "why": "فرق المواضع الفردية -2، ونسبة الزوجية 3؛ المطلوب من المواضع الفردية، وبعد 11 يأتي 9 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0243",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "42، 57، 74، 93، ؟ الحدود مربعات أعداد صحيحة موجبة متتالية تصاعديا، أضيف إليها عدد صحيح ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "57",
        "74",
        "114",
        "162"
      ],
      "answer": 2,
      "why": "الحدود هي المربعات ابتداء من 7² مع إضافة -7؛ لذلك التالي 11² − 7 = 114.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0244",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "1، 4، 9، 16، ؟ الحدود مربعات أعداد صحيحة موجبة تتحرك بخطوة ثابتة غير صفرية. ما العدد التالي؟",
      "choices": [
        "4",
        "9",
        "16",
        "25"
      ],
      "answer": 3,
      "why": "الجذور التربيعية الموجبة هي 1، 2، 3، 4، وخطوتها 1؛ التالي 5، و5² = 25.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0245",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "87، 29، 33، 11، 15، ؟ تتناوب عمليتا القسمة على عدد صحيح ثابت أكبر من 1 والجمع مع عدد صحيح ثابت غير صفري، بدءا بالقسمة. ما العدد التالي؟",
      "choices": [
        "5",
        "8",
        "9",
        "15"
      ],
      "answer": 0,
      "why": "تتناوب القسمة على 3 وإضافة 4؛ الدور الآن للقسمة: 15 ÷ 3 = 5.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0246",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "378، 126، 42، ؟ نسبة كل حد إلى سابقه ثابتة وبين 0 و1. ما العدد التالي؟",
      "choices": [
        "7",
        "14",
        "17",
        "21"
      ],
      "answer": 1,
      "why": "كل حد ناتج قسمة سابقه على 3؛ إذن 42 ÷ 3 = 14.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0247",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "36، 20، 49، 22، 64، 24، 81، ؟ المواضع الفردية مربعات أعداد صحيحة موجبة متتالية تصاعديا، والمواضع الزوجية متتالية حسابية بفرق غير صفري. ما العدد التالي؟",
      "choices": [
        "22",
        "26",
        "30",
        "32"
      ],
      "answer": 1,
      "why": "المواضع الفردية مربعات 6، 7، 8، 9، وفرق الزوجية 2؛ المطلوب من المواضع الزوجية، وبعد 24 يأتي 26 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0248",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "9، 4، 13، 17، 30، 47، ؟ من الحد الثالث، كل حد يساوي مجموع الحدين السابقين. ما العدد التالي؟",
      "choices": [
        "30",
        "47",
        "60",
        "77"
      ],
      "answer": 3,
      "why": "نجمع الحدين الأخيرين: 30 + 47 = 77.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0249",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "4، 3، 8، 9، 16، 27، ؟ المواضع الفردية متتالية هندسية، والمواضع الزوجية متتالية هندسية أخرى؛ والنسبة في كل منهما أكبر من 1. ما العدد التالي؟",
      "choices": [
        "32",
        "64",
        "128",
        "256"
      ],
      "answer": 0,
      "why": "نسبة المواضع الفردية 2، ونسبة الزوجية 3؛ المطلوب من المواضع الفردية، وبعد 16 يأتي 32 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0251",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "6، 24، 54، 96، ؟ الحدود مربعات أعداد صحيحة موجبة متتالية تصاعديا، ضربت في عدد صحيح ثابت أكبر من 1. ما العدد التالي؟",
      "choices": [
        "24",
        "54",
        "144",
        "150"
      ],
      "answer": 3,
      "why": "كل حد مربع عدد متتال مضروبا في 6؛ التالي 6 × 5² = 150.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0252",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "9، 18، 21، 42، 45، ؟ تتناوب عمليتا الضرب في عدد صحيح ثابت أكبر من 1 والجمع مع عدد صحيح ثابت غير صفري، بدءا بالضرب. ما العدد التالي؟",
      "choices": [
        "45",
        "48",
        "87",
        "90"
      ],
      "answer": 3,
      "why": "تتناوب عمليتا الضرب في 2 وإضافة 3؛ الدور الآن للضرب، لذلك 45 × 2 = 90.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0253",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "3، 5، 9، 15، 23، ؟ الفروق بين الحدود المتجاورة تتغير بمقدار ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "33",
        "35",
        "37",
        "39"
      ],
      "answer": 0,
      "why": "الفروق هي 2، 4، 6، 8، وتتغير بمقدار 2؛ الفرق التالي 10، فيكون 23 + 10 = 33.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0254",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "345، 115، 120، 40، 45، ؟ تتناوب عمليتا القسمة على عدد صحيح ثابت أكبر من 1 والجمع مع عدد صحيح ثابت غير صفري، بدءا بالقسمة. ما العدد التالي؟",
      "choices": [
        "10",
        "13",
        "14",
        "15"
      ],
      "answer": 3,
      "why": "تتناوب القسمة على 3 وإضافة 5؛ الدور الآن للقسمة: 45 ÷ 3 = 15.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0255",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "19، 34، 49، 64، ؟ الفروق بين الحدود المتجاورة ثابتة وموجبة. ما العدد التالي؟",
      "choices": [
        "79",
        "94",
        "109",
        "124"
      ],
      "answer": 0,
      "why": "الفرق الثابت هو 15؛ لذلك 64 + 15 = 79.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0256",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "121، 81، 49، 25، ؟ الحدود مربعات أعداد صحيحة موجبة تتحرك بخطوة ثابتة غير صفرية. ما العدد التالي؟",
      "choices": [
        "1",
        "4",
        "9",
        "36"
      ],
      "answer": 2,
      "why": "الجذور التربيعية الموجبة هي 11، 9، 7، 5، وخطوتها -2؛ التالي 3، و3² = 9.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0257",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "12، 13، 19، 17، 18، 24، 22، ؟ الفروق تتكرر في دورة من ثلاث قيم ثابتة مختلفة غير صفرية، بالترتيب نفسه. ما العدد التالي؟",
      "choices": [
        "23",
        "24",
        "25",
        "28"
      ],
      "answer": 0,
      "why": "الفروق تتكرر بالترتيب 1، 6، -2؛ الدور الآن لإضافة 1، لذلك 22 + 1 = 23.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0258",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "16، 20، 32، 68، 176، ؟ الفروق بين الحدود المتجاورة موجبة، ونسبة كل فرق إلى سابقه عدد صحيح ثابت أكبر من 1. ما العدد التالي؟",
      "choices": [
        "392",
        "500",
        "528",
        "716"
      ],
      "answer": 1,
      "why": "الفروق هي 4، 12، 36، 108، ونسبتها 3؛ الفرق التالي 324، فيكون 176 + 324 = 500.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0259",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "8، 5، 13، 18، 31، 49، ؟ من الحد الثالث، كل حد يساوي مجموع الحدين السابقين. ما العدد التالي؟",
      "choices": [
        "31",
        "49",
        "62",
        "80"
      ],
      "answer": 3,
      "why": "نجمع الحدين الأخيرين: 31 + 49 = 80.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0260",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "25، 12، 36، 16، 49، 20، 64، ؟ المواضع الفردية مربعات أعداد صحيحة موجبة متتالية تصاعديا، والمواضع الزوجية متتالية حسابية بفرق غير صفري. ما العدد التالي؟",
      "choices": [
        "24",
        "25",
        "32",
        "36"
      ],
      "answer": 0,
      "why": "المواضع الفردية مربعات 5، 6، 7، 8، وفرق الزوجية 4؛ المطلوب من المواضع الزوجية، وبعد 20 يأتي 24 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0261",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "19، 24، 28، 33، 37، ؟ الفروق بين الحدود المتجاورة تتناوب بين قيمتين ثابتتين مختلفتين غير صفريتين. ما العدد التالي؟",
      "choices": [
        "37",
        "41",
        "42",
        "47"
      ],
      "answer": 2,
      "why": "الفروق تتناوب بين 5 و4؛ الدور الآن لإضافة 5، لذلك 37 + 5 = 42.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0262",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "5، 10، 25، 70، 205، ؟ الفروق بين الحدود المتجاورة موجبة، ونسبة كل فرق إلى سابقه عدد صحيح ثابت أكبر من 1. ما العدد التالي؟",
      "choices": [
        "340",
        "475",
        "609",
        "610"
      ],
      "answer": 3,
      "why": "الفروق هي 5، 15، 45، 135، ونسبتها 3؛ الفرق التالي 405، فيكون 205 + 405 = 610.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0263",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "4، 8، 16، 28، 44، ؟ الفروق بين الحدود المتجاورة تتغير بمقدار ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "56",
        "64",
        "72",
        "76"
      ],
      "answer": 1,
      "why": "الفروق هي 4، 8، 12، 16، وتتغير بمقدار 4؛ الفرق التالي 20، فيكون 44 + 20 = 64.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0264",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "5، 12، 10، 36، 20، 108، 40، ؟ المواضع الفردية متتالية هندسية، والمواضع الزوجية متتالية هندسية أخرى؛ والنسبة في كل منهما أكبر من 1. ما العدد التالي؟",
      "choices": [
        "12",
        "36",
        "324",
        "972"
      ],
      "answer": 2,
      "why": "نسبة المواضع الفردية 2، ونسبة الزوجية 3؛ المطلوب من المواضع الزوجية، وبعد 108 يأتي 324 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0265",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "10، 16، 11، 32، 12، 64، 13، ؟ المواضع الفردية متتالية حسابية بفرق غير صفري، والمواضع الزوجية متتالية هندسية بنسبة أكبر من 1. ما العدد التالي؟",
      "choices": [
        "16",
        "32",
        "127",
        "128"
      ],
      "answer": 3,
      "why": "فرق المواضع الفردية 1، ونسبة الزوجية 2؛ المطلوب من المواضع الزوجية، وبعد 64 يأتي 128 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0266",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "5، 9، 18، 32، 51، ؟ الفروق بين الحدود المتجاورة تتغير بمقدار ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "60",
        "65",
        "75",
        "85"
      ],
      "answer": 2,
      "why": "الفروق هي 4، 9، 14، 19، وتتغير بمقدار 5؛ الفرق التالي 24، فيكون 51 + 24 = 75.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0267",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "الخميس، الثلاثاء، الأحد، الجمعة، ؟ الأيام تسير إلى الأمام بخطوة ثابتة من 1 إلى 6 أيام، مع العودة بعد الجمعة إلى السبت. ما اليوم التالي؟",
      "choices": [
        "الاثنين",
        "السبت",
        "الأربعاء",
        "الجمعة"
      ],
      "answer": 2,
      "why": "نتقدم 5 أيام في كل انتقال؛ من الجمعة نصل إلى الأربعاء مع دوران الأسبوع.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0268",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "32، 43، 56، 71، ؟ الحدود مربعات أعداد صحيحة موجبة متتالية تصاعديا، أضيف إليها عدد صحيح ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "88",
        "107",
        "128",
        "151"
      ],
      "answer": 0,
      "why": "الحدود هي المربعات ابتداء من 5² مع إضافة 7؛ لذلك التالي 9² + 7 = 88.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0269",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "7، 17، 21، 34، 63، 68، 189، ؟ المواضع الفردية متتالية هندسية، والمواضع الزوجية متتالية هندسية أخرى؛ والنسبة في كل منهما أكبر من 1. ما العدد التالي؟",
      "choices": [
        "34",
        "136",
        "272",
        "544"
      ],
      "answer": 1,
      "why": "نسبة المواضع الفردية 3، ونسبة الزوجية 2؛ المطلوب من المواضع الزوجية، وبعد 68 يأتي 136 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0270",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "15، 22، 26، 33، 37، ؟ الفروق بين الحدود المتجاورة تتناوب بين قيمتين ثابتتين مختلفتين غير صفريتين. ما العدد التالي؟",
      "choices": [
        "37",
        "41",
        "44",
        "51"
      ],
      "answer": 2,
      "why": "الفروق تتناوب بين 7 و4؛ الدور الآن لإضافة 7، لذلك 37 + 7 = 44.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0271",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "غ، ظ، ض، ش، ؟ الحروف تتحرك بخطوة ثابتة غير صفرية في الترتيب الهجائي العربي المعتاد، من دون التفاف عند طرفيه. ما الحرف التالي؟",
      "choices": [
        "ر",
        "د",
        "ز",
        "ض"
      ],
      "answer": 2,
      "why": "مواضع الحروف هي 19، 17، 15، 13، وخطوتها -2؛ الموضع التالي 11 وحرفه ز.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0272",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "24، 27، 24، 29، 32، 29، 34، 37، ؟ الفروق تتكرر في دورة من ثلاث قيم ثابتة مختلفة غير صفرية، بالترتيب نفسه. ما العدد التالي؟",
      "choices": [
        "31",
        "32",
        "33",
        "34"
      ],
      "answer": 3,
      "why": "الفروق تتكرر بالترتيب 3، -3، 5؛ الدور الآن لإضافة -3، لذلك 37 − 3 = 34.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0273",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "5، 10، 13، 12، 24، 27، 26، ؟ تتكرر دورة: الضرب في عدد صحيح ثابت أكبر من 1، ثم إضافة عدد صحيح موجب ثابت، ثم طرح عدد صحيح موجب ثابت مختلف عنه. ما العدد التالي؟",
      "choices": [
        "51",
        "52",
        "53",
        "54"
      ],
      "answer": 1,
      "why": "الدورة هي ×2، ثم +3، ثم −1؛ العملية التالية الضرب في 2، وناتجها 52.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0274",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "1331، 1000، 729، ؟ الحدود مكعبات أعداد صحيحة موجبة تتحرك بخطوة ثابتة غير صفرية. ما العدد التالي؟",
      "choices": [
        "512",
        "513",
        "1000",
        "1331"
      ],
      "answer": 0,
      "why": "الجذور التكعيبية الموجبة هي 11، 10، 9، وخطوتها -1؛ التالي 8، و8³ = 512.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0275",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "23، 32، 43، 56، ؟ الحدود مربعات أعداد صحيحة موجبة متتالية تصاعديا، أضيف إليها عدد صحيح ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "71",
        "88",
        "107",
        "128"
      ],
      "answer": 0,
      "why": "الحدود هي المربعات ابتداء من 4² مع إضافة 7؛ لذلك التالي 8² + 7 = 71.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0276",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "15، 22، 29، 36، ؟ الفروق بين الحدود المتجاورة ثابتة وموجبة. ما العدد التالي؟",
      "choices": [
        "22",
        "43",
        "57",
        "64"
      ],
      "answer": 1,
      "why": "الفرق الثابت هو 7؛ لذلك 36 + 7 = 43.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0277",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "4، 8، 10، 11، 16، 14، ؟ المواضع الفردية متتالية حسابية، والمواضع الزوجية متتالية حسابية أخرى؛ والفرق في كل منهما غير صفري. ما العدد التالي؟",
      "choices": [
        "22",
        "23",
        "34",
        "40"
      ],
      "answer": 0,
      "why": "فرق المواضع الفردية 6، وفرق الزوجية 3؛ المطلوب من المواضع الفردية، وبعد 16 يأتي 22 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0279",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "8، 17، 12، 19، 16، 21، 20، ؟ المواضع الفردية متتالية حسابية، والمواضع الزوجية متتالية حسابية أخرى؛ والفرق في كل منهما غير صفري. ما العدد التالي؟",
      "choices": [
        "17",
        "23",
        "25",
        "29"
      ],
      "answer": 1,
      "why": "فرق المواضع الفردية 4، وفرق الزوجية 2؛ المطلوب من المواضع الزوجية، وبعد 21 يأتي 23 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0280",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "و، ل، غ، ض، ؟ الحروف تتحرك بخطوة ثابتة غير صفرية في الترتيب الهجائي العربي المعتاد، من دون التفاف عند طرفيه. ما الحرف التالي؟",
      "choices": [
        "د",
        "ش",
        "ز",
        "ض"
      ],
      "answer": 2,
      "why": "مواضع الحروف هي 27، 23، 19، 15، وخطوتها -4؛ الموضع التالي 11 وحرفه ز.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0281",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "231، 253، 276، 300، ؟ الحدود أعداد مثلثية متتالية بخطوة ثابتة في ترتيبها؛ والعدد المثلثي هو مجموع الأعداد من 1 إلى عدد صحيح موجب. ما العدد التالي؟",
      "choices": [
        "325",
        "351",
        "378",
        "406"
      ],
      "answer": 0,
      "why": "ترتيب الأعداد المثلثية المعروضة هو 21، 22، 23، 24؛ التالي في الترتيب 25، وقيمته 25 × 26 ÷ 2 = 325.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0282",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "4، 3، 7، 10، 17، 27، ؟ من الحد الثالث، كل حد يساوي مجموع الحدين السابقين. ما العدد التالي؟",
      "choices": [
        "34",
        "44",
        "51",
        "54"
      ],
      "answer": 1,
      "why": "نجمع الحدين الأخيرين: 17 + 27 = 44.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0283",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "49، 100، 169، 256، ؟ الحدود مربعات أعداد صحيحة موجبة تتحرك بخطوة ثابتة غير صفرية. ما العدد التالي؟",
      "choices": [
        "361",
        "364",
        "441",
        "484"
      ],
      "answer": 0,
      "why": "الجذور التربيعية الموجبة هي 7، 10، 13، 16، وخطوتها 3؛ التالي 19، و19² = 361.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0284",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "3، 6، 13، 26، 33، ؟ تتناوب عمليتا الضرب في عدد صحيح ثابت أكبر من 1 والجمع مع عدد صحيح ثابت غير صفري، بدءا بالضرب. ما العدد التالي؟",
      "choices": [
        "33",
        "40",
        "59",
        "66"
      ],
      "answer": 3,
      "why": "تتناوب عمليتا الضرب في 2 وإضافة 7؛ الدور الآن للضرب، لذلك 33 × 2 = 66.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0285",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "4، 23، 12، 46، 36، 92، 108، ؟ المواضع الفردية متتالية هندسية، والمواضع الزوجية متتالية هندسية أخرى؛ والنسبة في كل منهما أكبر من 1. ما العدد التالي؟",
      "choices": [
        "184",
        "368",
        "736",
        "1472"
      ],
      "answer": 0,
      "why": "نسبة المواضع الفردية 3، ونسبة الزوجية 2؛ المطلوب من المواضع الزوجية، وبعد 92 يأتي 184 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0286",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "1، 37، 86، 150، ؟ الفروق بين الحدود المتجاورة مربعات أعداد صحيحة موجبة متتالية تصاعديا. ما العدد التالي؟",
      "choices": [
        "186",
        "199",
        "222",
        "231"
      ],
      "answer": 3,
      "why": "الفروق 36، 49، 64 هي مربعات 6، 7، 8؛ التالي 9² = 81، ثم 150 + 81 = 231.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0287",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "325، 300، 276، 253، ؟ الحدود أعداد مثلثية متتالية بخطوة ثابتة في ترتيبها؛ والعدد المثلثي هو مجموع الأعداد من 1 إلى عدد صحيح موجب. ما العدد التالي؟",
      "choices": [
        "190",
        "231",
        "276",
        "300"
      ],
      "answer": 1,
      "why": "ترتيب الأعداد المثلثية المعروضة هو 25، 24، 23، 22؛ التالي في الترتيب 21، وقيمته 21 × 22 ÷ 2 = 231.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0288",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "4، 20، 9، 23، 16، 26، 25، ؟ المواضع الفردية مربعات أعداد صحيحة موجبة متتالية تصاعديا، والمواضع الزوجية متتالية حسابية بفرق غير صفري. ما العدد التالي؟",
      "choices": [
        "29",
        "30",
        "35",
        "38"
      ],
      "answer": 0,
      "why": "المواضع الفردية مربعات 2، 3، 4، 5، وفرق الزوجية 3؛ المطلوب من المواضع الزوجية، وبعد 26 يأتي 29 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0289",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "1، 7، 8، 15، 23، 38، ؟ من الحد الثالث، كل حد يساوي مجموع الحدين السابقين. ما العدد التالي؟",
      "choices": [
        "23",
        "46",
        "61",
        "69"
      ],
      "answer": 2,
      "why": "نجمع الحدين الأخيرين: 23 + 38 = 61.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0290",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "18، 25، 22، 29، 26، 33، ؟ الفروق بين الحدود المتجاورة تتناوب بين قيمتين ثابتتين مختلفتين غير صفريتين. ما العدد التالي؟",
      "choices": [
        "27",
        "28",
        "29",
        "30"
      ],
      "answer": 3,
      "why": "الفروق تتناوب بين 7 و-3؛ الدور الآن لإضافة -3، لذلك 33 − 3 = 30.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0291",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "2، 21، 4، 63، 6، 189، ؟ المواضع الفردية متتالية حسابية بفرق غير صفري، والمواضع الزوجية متتالية هندسية بنسبة أكبر من 1. ما العدد التالي؟",
      "choices": [
        "4",
        "8",
        "12",
        "14"
      ],
      "answer": 1,
      "why": "فرق المواضع الفردية 2، ونسبة الزوجية 3؛ المطلوب من المواضع الفردية، وبعد 6 يأتي 8 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0293",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "5، 13، 29، 61، ؟ كل حد يساوي سابقه مضروبا في عدد صحيح ثابت أكبر من 1، ثم مضافا إليه عدد صحيح ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "67",
        "125",
        "183",
        "186"
      ],
      "answer": 1,
      "why": "في كل انتقال نضرب في 2 ثم نضيف 3؛ لذلك 2 × 61 + 3 = 125.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0294",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "69، 130، 221، ؟ الحدود مكعبات أعداد صحيحة موجبة متتالية تصاعديا، أضيف إليها عدد صحيح ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "69",
        "130",
        "348",
        "734"
      ],
      "answer": 2,
      "why": "الحدود هي المكعبات ابتداء من 4³ مع إضافة 5؛ لذلك التالي 7³ + 5 = 348.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0295",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "6، 24، 18، 48، 54، 96، ؟ المواضع الفردية متتالية هندسية، والمواضع الزوجية متتالية هندسية أخرى؛ والنسبة في كل منهما أكبر من 1. ما العدد التالي؟",
      "choices": [
        "162",
        "486",
        "1458",
        "4374"
      ],
      "answer": 0,
      "why": "نسبة المواضع الفردية 3، ونسبة الزوجية 2؛ المطلوب من المواضع الفردية، وبعد 54 يأتي 162 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0296",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "ر، س، ص، ط، ؟ الحروف تتحرك بخطوة ثابتة غير صفرية في الترتيب الهجائي العربي المعتاد، من دون التفاف عند طرفيه. ما الحرف التالي؟",
      "choices": [
        "ع",
        "ظ",
        "ق",
        "ط"
      ],
      "answer": 0,
      "why": "مواضع الحروف هي 10، 12، 14، 16، وخطوتها 2؛ الموضع التالي 18 وحرفه ع.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0297",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "1728، 1000، 512، ؟ الحدود مكعبات أعداد صحيحة موجبة تتحرك بخطوة ثابتة غير صفرية. ما العدد التالي؟",
      "choices": [
        "64",
        "216",
        "218",
        "729"
      ],
      "answer": 1,
      "why": "الجذور التكعيبية الموجبة هي 12، 10، 8، وخطوتها -2؛ التالي 6، و6³ = 216.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0298",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "4، 11، 17، 22، 26، ؟ الفروق بين الحدود المتجاورة تتغير بمقدار ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "29",
        "30",
        "31",
        "32"
      ],
      "answer": 0,
      "why": "الفروق هي 7، 6، 5، 4، وتتغير بمقدار -1؛ الفرق التالي 3، فيكون 26 + 3 = 29.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0300",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "ز، ر، ذ، د، ؟ الحروف تتحرك بخطوة ثابتة غير صفرية في الترتيب الهجائي العربي المعتاد، من دون التفاف عند طرفيه. ما الحرف التالي؟",
      "choices": [
        "ر",
        "خ",
        "ذ",
        "د"
      ],
      "answer": 1,
      "why": "مواضع الحروف هي 11، 10، 9، 8، وخطوتها -1؛ الموضع التالي 7 وحرفه خ.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0301",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "4، 13، 25، 40، 58، ؟ الفروق بين الحدود المتجاورة تتغير بمقدار ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "70",
        "73",
        "76",
        "79"
      ],
      "answer": 3,
      "why": "الفروق هي 9، 12، 15، 18، وتتغير بمقدار 3؛ الفرق التالي 21، فيكون 58 + 21 = 79.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0302",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "1، 7، 15، 37، 89، ؟ من الحد الثالث، كل حد يساوي حاصل ضرب سابقه في 2، مضافا إليه ما قبله. ما العدد التالي؟",
      "choices": [
        "215",
        "267",
        "289",
        "341"
      ],
      "answer": 0,
      "why": "نضرب الحد الأخير في 2 ثم نضيف ما قبله: 2 × 89 + 37 = 215.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0303",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "25، 26، 34، 61، ؟ الفروق بين الحدود المتجاورة مكعبات أعداد صحيحة موجبة متتالية تصاعديا. ما العدد التالي؟",
      "choices": [
        "62",
        "69",
        "125",
        "277"
      ],
      "answer": 2,
      "why": "الفروق 1، 8، 27 هي مكعبات 1، 2، 3؛ التالي 4³ = 64، ثم 61 + 64 = 125.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0304",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "1، 8، 9، 17، 26، 43، ؟ من الحد الثالث، كل حد يساوي مجموع الحدين السابقين. ما العدد التالي؟",
      "choices": [
        "52",
        "69",
        "78",
        "86"
      ],
      "answer": 1,
      "why": "نجمع الحدين الأخيرين: 26 + 43 = 69.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0305",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "11، 35، 107، 323، ؟ كل حد يساوي سابقه مضروبا في عدد صحيح ثابت أكبر من 1، ثم مضافا إليه عدد صحيح ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "648",
        "650",
        "971",
        "1292"
      ],
      "answer": 2,
      "why": "في كل انتقال نضرب في 3 ثم نضيف 2؛ لذلك 3 × 323 + 2 = 971.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0306",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "36، 12، 49، 17، 64، 22، ؟ المواضع الفردية مربعات أعداد صحيحة موجبة متتالية تصاعديا، والمواضع الزوجية متتالية حسابية بفرق غير صفري. ما العدد التالي؟",
      "choices": [
        "81",
        "100",
        "121",
        "144"
      ],
      "answer": 0,
      "why": "المواضع الفردية مربعات 6، 7، 8، وفرق الزوجية 5؛ المطلوب من المواضع الفردية، وبعد 64 يأتي 81 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0307",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "10، 5، 30، 10، 90، 20، 270، ؟ المواضع الفردية متتالية هندسية، والمواضع الزوجية متتالية هندسية أخرى؛ والنسبة في كل منهما أكبر من 1. ما العدد التالي؟",
      "choices": [
        "10",
        "40",
        "80",
        "160"
      ],
      "answer": 1,
      "why": "نسبة المواضع الفردية 3، ونسبة الزوجية 2؛ المطلوب من المواضع الزوجية، وبعد 20 يأتي 40 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0309",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "171، 153، 136، 120، ؟ الحدود أعداد مثلثية متتالية بخطوة ثابتة في ترتيبها؛ والعدد المثلثي هو مجموع الأعداد من 1 إلى عدد صحيح موجب. ما العدد التالي؟",
      "choices": [
        "66",
        "78",
        "91",
        "105"
      ],
      "answer": 3,
      "why": "ترتيب الأعداد المثلثية المعروضة هو 18، 17، 16، 15؛ التالي في الترتيب 14، وقيمته 14 × 15 ÷ 2 = 105.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0310",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "16، 24، 28، 36، 40، 48، ؟ الفروق بين الحدود المتجاورة تتناوب بين قيمتين ثابتتين مختلفتين غير صفريتين. ما العدد التالي؟",
      "choices": [
        "44",
        "48",
        "52",
        "56"
      ],
      "answer": 2,
      "why": "الفروق تتناوب بين 8 و4؛ الدور الآن لإضافة 4، لذلك 48 + 4 = 52.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0311",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "12، 13، 24، 39، 48، 117، ؟ المواضع الفردية متتالية هندسية، والمواضع الزوجية متتالية هندسية أخرى؛ والنسبة في كل منهما أكبر من 1. ما العدد التالي؟",
      "choices": [
        "12",
        "24",
        "96",
        "192"
      ],
      "answer": 2,
      "why": "نسبة المواضع الفردية 2، ونسبة الزوجية 3؛ المطلوب من المواضع الفردية، وبعد 48 يأتي 96 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0312",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "5، 15، 20، 14، 42، 47، 41، ؟ تتكرر دورة: الضرب في عدد صحيح ثابت أكبر من 1، ثم إضافة عدد صحيح موجب ثابت، ثم طرح عدد صحيح موجب ثابت مختلف عنه. ما العدد التالي؟",
      "choices": [
        "41",
        "46",
        "122",
        "123"
      ],
      "answer": 3,
      "why": "الدورة هي ×3، ثم +5، ثم −6؛ العملية التالية الضرب في 3، وناتجها 123.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0313",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "57، 50، 43، 36، ؟ الفروق بين الحدود المتجاورة ثابتة وسالبة. ما العدد التالي؟",
      "choices": [
        "15",
        "29",
        "36",
        "50"
      ],
      "answer": 1,
      "why": "الفرق الثابت هو -7؛ لذلك 36 − 7 = 29.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0314",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "23، 31، 41، 47، ؟ الحدود أعداد أولية تصاعديا؛ يؤخذ عدد أولي ويترك الذي يليه، ويتكرر ذلك. ما العدد التالي؟",
      "choices": [
        "59",
        "60",
        "67",
        "71"
      ],
      "answer": 0,
      "why": "بعد 47 يأتي الأولي 53 فنتركه، ثم نأخذ 59، مع استمرار أخذ أولي وترك الذي يليه.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0315",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "9، 27، 29، 24، 72، 74، 69، ؟ تتكرر دورة: الضرب في عدد صحيح ثابت أكبر من 1، ثم إضافة عدد صحيح موجب ثابت، ثم طرح عدد صحيح موجب ثابت مختلف عنه. ما العدد التالي؟",
      "choices": [
        "207",
        "208",
        "209",
        "210"
      ],
      "answer": 0,
      "why": "الدورة هي ×3، ثم +2، ثم −5؛ العملية التالية الضرب في 3، وناتجها 207.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0316",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "16، 21، 25، 30، 34، ؟ الفروق بين الحدود المتجاورة تتناوب بين قيمتين ثابتتين مختلفتين غير صفريتين. ما العدد التالي؟",
      "choices": [
        "38",
        "39",
        "40",
        "44"
      ],
      "answer": 1,
      "why": "الفروق تتناوب بين 5 و4؛ الدور الآن لإضافة 5، لذلك 34 + 5 = 39.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0317",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "10، 20، 11، 40، 12، 80، ؟ المواضع الفردية متتالية حسابية بفرق غير صفري، والمواضع الزوجية متتالية هندسية بنسبة أكبر من 1. ما العدد التالي؟",
      "choices": [
        "11",
        "13",
        "15",
        "16"
      ],
      "answer": 1,
      "why": "فرق المواضع الفردية 1، ونسبة الزوجية 2؛ المطلوب من المواضع الفردية، وبعد 12 يأتي 13 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0319",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "144، 22، 169، 28، 196، 34، ؟ المواضع الفردية مربعات أعداد صحيحة موجبة متتالية تصاعديا، والمواضع الزوجية متتالية حسابية بفرق غير صفري. ما العدد التالي؟",
      "choices": [
        "144",
        "169",
        "224",
        "225"
      ],
      "answer": 3,
      "why": "المواضع الفردية مربعات 12، 13، 14، وفرق الزوجية 6؛ المطلوب من المواضع الفردية، وبعد 196 يأتي 225 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0320",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "15، 31، 56، 92، ؟ الفروق بين الحدود المتجاورة مربعات أعداد صحيحة موجبة متتالية تصاعديا. ما العدد التالي؟",
      "choices": [
        "108",
        "117",
        "134",
        "141"
      ],
      "answer": 3,
      "why": "الفروق 16، 25، 36 هي مربعات 4، 5، 6؛ التالي 7² = 49، ثم 92 + 49 = 141.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0321",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "3، 9، 15، 45، 51، 153، ؟ تتناوب عمليتا الضرب في عدد صحيح ثابت أكبر من 1 والجمع مع عدد صحيح ثابت غير صفري، بدءا بالضرب. ما العدد التالي؟",
      "choices": [
        "153",
        "158",
        "159",
        "162"
      ],
      "answer": 2,
      "why": "تتناوب عمليتا الضرب في 3 وإضافة 6؛ الدور الآن للجمع، لذلك 153 + 6 = 159.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0322",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "ث، خ، ر، ش، ؟ الحروف تتحرك بخطوة ثابتة غير صفرية في الترتيب الهجائي العربي المعتاد، من دون التفاف عند طرفيه. ما الحرف التالي؟",
      "choices": [
        "ف",
        "ع",
        "ط",
        "غ"
      ],
      "answer": 2,
      "why": "مواضع الحروف هي 4، 7، 10، 13، وخطوتها 3؛ الموضع التالي 16 وحرفه ط.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0323",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "9، 18، 24، 21، 42، 48، 45، 90، 96، ؟ تتكرر دورة: الضرب في عدد صحيح ثابت أكبر من 1، ثم إضافة عدد صحيح موجب ثابت، ثم طرح عدد صحيح موجب ثابت مختلف عنه. ما العدد التالي؟",
      "choices": [
        "91",
        "92",
        "93",
        "94"
      ],
      "answer": 2,
      "why": "الدورة هي ×2، ثم +6، ثم −3؛ العملية التالية طرح 3، وناتجها 93.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0324",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "14، 18، 28، 54، 56، 162، ؟ المواضع الفردية متتالية هندسية، والمواضع الزوجية متتالية هندسية أخرى؛ والنسبة في كل منهما أكبر من 1. ما العدد التالي؟",
      "choices": [
        "112",
        "224",
        "448",
        "896"
      ],
      "answer": 0,
      "why": "نسبة المواضع الفردية 2، ونسبة الزوجية 3؛ المطلوب من المواضع الفردية، وبعد 56 يأتي 112 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0325",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "13، 17، 16، 23، 27، 26، 33، 37، 36، ؟ الفروق تتكرر في دورة من ثلاث قيم ثابتة مختلفة غير صفرية، بالترتيب نفسه. ما العدد التالي؟",
      "choices": [
        "36",
        "40",
        "42",
        "43"
      ],
      "answer": 3,
      "why": "الفروق تتكرر بالترتيب 4، -1، 7؛ الدور الآن لإضافة 7، لذلك 36 + 7 = 43.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0326",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "الأربعاء، الجمعة، الأحد، الثلاثاء، ؟ الأيام تسير إلى الأمام بخطوة ثابتة من 1 إلى 6 أيام، مع العودة بعد الجمعة إلى السبت. ما اليوم التالي؟",
      "choices": [
        "الخميس",
        "الجمعة",
        "الأحد",
        "الثلاثاء"
      ],
      "answer": 0,
      "why": "نتقدم يومين في كل انتقال؛ من الثلاثاء نصل إلى الخميس مع دوران الأسبوع.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0327",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "27، 216، 729، ؟ الحدود مكعبات أعداد صحيحة موجبة تتحرك بخطوة ثابتة غير صفرية. ما العدد التالي؟",
      "choices": [
        "729",
        "1000",
        "1331",
        "1728"
      ],
      "answer": 3,
      "why": "الجذور التكعيبية الموجبة هي 3، 6، 9، وخطوتها 3؛ التالي 12، و12³ = 1728.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0328",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "8، 64، 216، ؟ الحدود مكعبات أعداد صحيحة موجبة تتحرك بخطوة ثابتة غير صفرية. ما العدد التالي؟",
      "choices": [
        "125",
        "343",
        "512",
        "1000"
      ],
      "answer": 2,
      "why": "الجذور التكعيبية الموجبة هي 2، 4، 6، وخطوتها 2؛ التالي 8، و8³ = 512.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0329",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "5، 7، 11، 19، ؟ كل حد يساوي سابقه مضروبا في عدد صحيح ثابت أكبر من 1، ثم مضافا إليه عدد صحيح ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "19",
        "35",
        "51",
        "54"
      ],
      "answer": 1,
      "why": "في كل انتقال نضرب في 2 ثم نضيف -3؛ لذلك 2 × 19 − 3 = 35.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0331",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "3، 7، 19، 55، 163، ؟ الفروق بين الحدود المتجاورة موجبة، ونسبة كل فرق إلى سابقه عدد صحيح ثابت أكبر من 1. ما العدد التالي؟",
      "choices": [
        "271",
        "379",
        "487",
        "703"
      ],
      "answer": 2,
      "why": "الفروق هي 4، 12، 36، 108، ونسبتها 3؛ الفرق التالي 324، فيكون 163 + 324 = 487.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0332",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "5، 10، 11، 5، 10، 11، 5، ؟ تتكرر دورة: الضرب في عدد صحيح ثابت أكبر من 1، ثم إضافة عدد صحيح موجب ثابت، ثم طرح عدد صحيح موجب ثابت مختلف عنه. ما العدد التالي؟",
      "choices": [
        "5",
        "6",
        "9",
        "10"
      ],
      "answer": 3,
      "why": "الدورة هي ×2، ثم +1، ثم −6؛ العملية التالية الضرب في 2، وناتجها 10.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0333",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "68، 57، 46، 35، ؟ الفروق بين الحدود المتجاورة ثابتة وسالبة. ما العدد التالي؟",
      "choices": [
        "2",
        "24",
        "35",
        "57"
      ],
      "answer": 1,
      "why": "الفرق الثابت هو -11؛ لذلك 35 − 11 = 24.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0334",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "6، 1، 2، 9، 12، 23، ؟ من الحد الرابع، كل حد يساوي مجموع الحدود الثلاثة السابقة مباشرة. ما العدد التالي؟",
      "choices": [
        "21",
        "32",
        "35",
        "44"
      ],
      "answer": 3,
      "why": "نجمع آخر ثلاثة حدود: 9 + 12 + 23 = 44.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0337",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "3، 2، 7، 16، 39، ؟ من الحد الثالث، كل حد يساوي حاصل ضرب سابقه في 2، مضافا إليه ما قبله. ما العدد التالي؟",
      "choices": [
        "94",
        "117",
        "126",
        "149"
      ],
      "answer": 0,
      "why": "نضرب الحد الأخير في 2 ثم نضيف ما قبله: 2 × 39 + 16 = 94.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0338",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "4، 8، 12، 6، 12، 16، 10، 20، 24، ؟ تتكرر دورة: الضرب في عدد صحيح ثابت أكبر من 1، ثم إضافة عدد صحيح موجب ثابت، ثم طرح عدد صحيح موجب ثابت مختلف عنه. ما العدد التالي؟",
      "choices": [
        "17",
        "18",
        "19",
        "24"
      ],
      "answer": 1,
      "why": "الدورة هي ×2، ثم +4، ثم −6؛ العملية التالية طرح 6، وناتجها 18.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0339",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "32، 69، 130، ؟ الحدود مكعبات أعداد صحيحة موجبة متتالية تصاعديا، أضيف إليها عدد صحيح ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "69",
        "221",
        "517",
        "734"
      ],
      "answer": 1,
      "why": "الحدود هي المكعبات ابتداء من 3³ مع إضافة 5؛ لذلك التالي 6³ + 5 = 221.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0340",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "14، 20، 38، 92، 254، ؟ الفروق بين الحدود المتجاورة موجبة، ونسبة كل فرق إلى سابقه عدد صحيح ثابت أكبر من 1. ما العدد التالي؟",
      "choices": [
        "740",
        "762",
        "902",
        "1064"
      ],
      "answer": 0,
      "why": "الفروق هي 6، 18، 54، 162، ونسبتها 3؛ الفرق التالي 486، فيكون 254 + 486 = 740.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0341",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "4، 8، 15، 30، 37، 74، ؟ تتناوب عمليتا الضرب في عدد صحيح ثابت أكبر من 1 والجمع مع عدد صحيح ثابت غير صفري، بدءا بالضرب. ما العدد التالي؟",
      "choices": [
        "74",
        "79",
        "80",
        "81"
      ],
      "answer": 3,
      "why": "تتناوب عمليتا الضرب في 2 وإضافة 7؛ الدور الآن للجمع، لذلك 74 + 7 = 81.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0343",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "5، 10، 18، 36، 44، 88، ؟ تتناوب عمليتا الضرب في عدد صحيح ثابت أكبر من 1 والجمع مع عدد صحيح ثابت غير صفري، بدءا بالضرب. ما العدد التالي؟",
      "choices": [
        "96",
        "98",
        "104",
        "176"
      ],
      "answer": 0,
      "why": "تتناوب عمليتا الضرب في 2 وإضافة 8؛ الدور الآن للجمع، لذلك 88 + 8 = 96.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0344",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "11، 19، 46، 110، ؟ الفروق بين الحدود المتجاورة مكعبات أعداد صحيحة موجبة متتالية تصاعديا. ما العدد التالي؟",
      "choices": [
        "235",
        "240",
        "453",
        "622"
      ],
      "answer": 0,
      "why": "الفروق 8، 27، 64 هي مكعبات 2، 3، 4؛ التالي 5³ = 125، ثم 110 + 125 = 235.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0345",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "14، 19، 42، 38، 126، 76، 378، ؟ المواضع الفردية متتالية هندسية، والمواضع الزوجية متتالية هندسية أخرى؛ والنسبة في كل منهما أكبر من 1. ما العدد التالي؟",
      "choices": [
        "152",
        "304",
        "608",
        "1216"
      ],
      "answer": 0,
      "why": "نسبة المواضع الفردية 3، ونسبة الزوجية 2؛ المطلوب من المواضع الزوجية، وبعد 76 يأتي 152 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0346",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "10، 14، 22، 34، 50، ؟ الفروق بين الحدود المتجاورة تتغير بمقدار ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "58",
        "62",
        "70",
        "78"
      ],
      "answer": 2,
      "why": "الفروق هي 4، 8، 12، 16، وتتغير بمقدار 4؛ الفرق التالي 20، فيكون 50 + 20 = 70.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0347",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "9، 14، 7، 17، 5، 20، 3، ؟ المواضع الفردية متتالية حسابية، والمواضع الزوجية متتالية حسابية أخرى؛ والفرق في كل منهما غير صفري. ما العدد التالي؟",
      "choices": [
        "23",
        "26",
        "29",
        "32"
      ],
      "answer": 0,
      "why": "فرق المواضع الفردية -2، وفرق الزوجية 3؛ المطلوب من المواضع الزوجية، وبعد 20 يأتي 23 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0348",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "4، 10، 28، 82، 244، ؟ الفروق بين الحدود المتجاورة موجبة، ونسبة كل فرق إلى سابقه عدد صحيح ثابت أكبر من 1. ما العدد التالي؟",
      "choices": [
        "730",
        "732",
        "892",
        "1054"
      ],
      "answer": 0,
      "why": "الفروق هي 6، 18، 54، 162، ونسبتها 3؛ الفرق التالي 486، فيكون 244 + 486 = 730.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0349",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "58، 29، 34، 17، 22، ؟ تتناوب عمليتا القسمة على عدد صحيح ثابت أكبر من 1 والجمع مع عدد صحيح ثابت غير صفري، بدءا بالقسمة. ما العدد التالي؟",
      "choices": [
        "6",
        "11",
        "13",
        "16"
      ],
      "answer": 1,
      "why": "تتناوب القسمة على 2 وإضافة 5؛ الدور الآن للقسمة: 22 ÷ 2 = 11.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0350",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "40، 34، 28، 22، ؟ الفروق بين الحدود المتجاورة ثابتة وسالبة. ما العدد التالي؟",
      "choices": [
        "4",
        "10",
        "16",
        "34"
      ],
      "answer": 2,
      "why": "الفرق الثابت هو -6؛ لذلك 22 − 6 = 16.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0351",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "245، 320، 405، 500، ؟ الحدود مربعات أعداد صحيحة موجبة متتالية تصاعديا، ضربت في عدد صحيح ثابت أكبر من 1. ما العدد التالي؟",
      "choices": [
        "405",
        "605",
        "845",
        "980"
      ],
      "answer": 1,
      "why": "كل حد مربع عدد متتال مضروبا في 5؛ التالي 5 × 11² = 605.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0353",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "7، 1، 8، 9، 17، 26، ؟ من الحد الثالث، كل حد يساوي مجموع الحدين السابقين. ما العدد التالي؟",
      "choices": [
        "17",
        "34",
        "43",
        "51"
      ],
      "answer": 2,
      "why": "نجمع الحدين الأخيرين: 17 + 26 = 43.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0354",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "82، 70، 58، 46، ؟ الفروق بين الحدود المتجاورة ثابتة وسالبة. ما العدد التالي؟",
      "choices": [
        "10",
        "22",
        "34",
        "70"
      ],
      "answer": 2,
      "why": "الفرق الثابت هو -12؛ لذلك 46 − 12 = 34.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0355",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "3، 20، 5، 60، 7، 180، 9، ؟ المواضع الفردية متتالية حسابية بفرق غير صفري، والمواضع الزوجية متتالية هندسية بنسبة أكبر من 1. ما العدد التالي؟",
      "choices": [
        "540",
        "1620",
        "4860",
        "14580"
      ],
      "answer": 0,
      "why": "فرق المواضع الفردية 2، ونسبة الزوجية 3؛ المطلوب من المواضع الزوجية، وبعد 180 يأتي 540 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0356",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "5، 10، 13، 8، 16، 19، 14، 28، ؟ تتكرر دورة: الضرب في عدد صحيح ثابت أكبر من 1، ثم إضافة عدد صحيح موجب ثابت، ثم طرح عدد صحيح موجب ثابت مختلف عنه. ما العدد التالي؟",
      "choices": [
        "28",
        "30",
        "31",
        "32"
      ],
      "answer": 2,
      "why": "الدورة هي ×2، ثم +3، ثم −5؛ العملية التالية إضافة 3، وناتجها 31.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0357",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "9، 27، 30، 29، 87، 90، 89، ؟ تتكرر دورة: الضرب في عدد صحيح ثابت أكبر من 1، ثم إضافة عدد صحيح موجب ثابت، ثم طرح عدد صحيح موجب ثابت مختلف عنه. ما العدد التالي؟",
      "choices": [
        "92",
        "266",
        "267",
        "268"
      ],
      "answer": 2,
      "why": "الدورة هي ×3، ثم +3، ثم −1؛ العملية التالية الضرب في 3، وناتجها 267.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0358",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "5، 12، 21، 32، ؟ الحدود مربعات أعداد صحيحة موجبة متتالية تصاعديا، أضيف إليها عدد صحيح ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "21",
        "45",
        "77",
        "96"
      ],
      "answer": 1,
      "why": "الحدود هي المربعات ابتداء من 3² مع إضافة -4؛ لذلك التالي 7² − 4 = 45.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0359",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "289، 196، 121، 64، ؟ الحدود مربعات أعداد صحيحة موجبة تتحرك بخطوة ثابتة غير صفرية. ما العدد التالي؟",
      "choices": [
        "4",
        "9",
        "16",
        "25"
      ],
      "answer": 3,
      "why": "الجذور التربيعية الموجبة هي 17، 14، 11، 8، وخطوتها -3؛ التالي 5، و5² = 25.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0360",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "144، 72، 76، 38، 42، ؟ تتناوب عمليتا القسمة على عدد صحيح ثابت أكبر من 1 والجمع مع عدد صحيح ثابت غير صفري، بدءا بالقسمة. ما العدد التالي؟",
      "choices": [
        "21",
        "23",
        "25",
        "42"
      ],
      "answer": 0,
      "why": "تتناوب القسمة على 2 وإضافة 4؛ الدور الآن للقسمة: 42 ÷ 2 = 21.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0361",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "4، 12، 13، 11، 33، 34، 32، 96، ؟ تتكرر دورة: الضرب في عدد صحيح ثابت أكبر من 1، ثم إضافة عدد صحيح موجب ثابت، ثم طرح عدد صحيح موجب ثابت مختلف عنه. ما العدد التالي؟",
      "choices": [
        "94",
        "95",
        "96",
        "97"
      ],
      "answer": 3,
      "why": "الدورة هي ×3، ثم +1، ثم −2؛ العملية التالية إضافة 1، وناتجها 97.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0362",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "17، 19، 23، 29، ؟ الحدود أعداد أولية متتالية تصاعديا. ما العدد التالي؟",
      "choices": [
        "19",
        "23",
        "30",
        "31"
      ],
      "answer": 3,
      "why": "الأعداد المعروضة أولية متتالية؛ أول عدد أولي بعد 29 هو 31.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0364",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "السبت، الاثنين، الأربعاء، الجمعة، ؟ الأيام تسير إلى الأمام بخطوة ثابتة من 1 إلى 6 أيام، مع العودة بعد الجمعة إلى السبت. ما اليوم التالي؟",
      "choices": [
        "الجمعة",
        "الأربعاء",
        "الأحد",
        "الاثنين"
      ],
      "answer": 2,
      "why": "نتقدم يومين في كل انتقال؛ من الجمعة نصل إلى الأحد مع دوران الأسبوع.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0365",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "1، 20، 57، ؟ الحدود مكعبات أعداد صحيحة موجبة متتالية تصاعديا، أضيف إليها عدد صحيح ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "20",
        "118",
        "336",
        "505"
      ],
      "answer": 1,
      "why": "الحدود هي المكعبات ابتداء من 2³ مع إضافة -7؛ لذلك التالي 5³ − 7 = 118.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0366",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "الجمعة، الثلاثاء، السبت، الأربعاء، ؟ الأيام تسير إلى الأمام بخطوة ثابتة من 1 إلى 6 أيام، مع العودة بعد الجمعة إلى السبت. ما اليوم التالي؟",
      "choices": [
        "الأربعاء",
        "الأحد",
        "الخميس",
        "الاثنين"
      ],
      "answer": 1,
      "why": "نتقدم 4 أيام في كل انتقال؛ من الأربعاء نصل إلى الأحد مع دوران الأسبوع.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0367",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "1، 4، 13، 43، 142، ؟ من الحد الثالث، كل حد يساوي حاصل ضرب سابقه في 3، مضافا إليه ما قبله. ما العدد التالي؟",
      "choices": [
        "469",
        "512",
        "555",
        "611"
      ],
      "answer": 0,
      "why": "نضرب الحد الأخير في 3 ثم نضيف ما قبله: 3 × 142 + 43 = 469.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0368",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "9، 6، 10، 12، 11، 24، 12، ؟ المواضع الفردية متتالية حسابية بفرق غير صفري، والمواضع الزوجية متتالية هندسية بنسبة أكبر من 1. ما العدد التالي؟",
      "choices": [
        "6",
        "24",
        "47",
        "48"
      ],
      "answer": 3,
      "why": "فرق المواضع الفردية 1، ونسبة الزوجية 2؛ المطلوب من المواضع الزوجية، وبعد 24 يأتي 48 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0369",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "15، 22، 31، 42، ؟ الحدود مربعات أعداد صحيحة موجبة متتالية تصاعديا، أضيف إليها عدد صحيح ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "55",
        "70",
        "87",
        "106"
      ],
      "answer": 0,
      "why": "الحدود هي المربعات ابتداء من 3² مع إضافة 6؛ لذلك التالي 7² + 6 = 55.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0370",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "48، 75، 108، 147، ؟ الحدود مربعات أعداد صحيحة موجبة متتالية تصاعديا، ضربت في عدد صحيح ثابت أكبر من 1. ما العدد التالي؟",
      "choices": [
        "108",
        "192",
        "300",
        "363"
      ],
      "answer": 1,
      "why": "كل حد مربع عدد متتال مضروبا في 3؛ التالي 3 × 8² = 192.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0371",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "18، 19، 23، 32، ؟ الفروق بين الحدود المتجاورة مربعات أعداد صحيحة موجبة متتالية تصاعديا. ما العدد التالي؟",
      "choices": [
        "48",
        "52",
        "68",
        "81"
      ],
      "answer": 0,
      "why": "الفروق 1، 4، 9 هي مربعات 1، 2، 3؛ التالي 4² = 16، ثم 32 + 16 = 48.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0372",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "45، 80، 125، 180، ؟ الحدود مربعات أعداد صحيحة موجبة متتالية تصاعديا، ضربت في عدد صحيح ثابت أكبر من 1. ما العدد التالي؟",
      "choices": [
        "125",
        "245",
        "405",
        "500"
      ],
      "answer": 1,
      "why": "كل حد مربع عدد متتال مضروبا في 5؛ التالي 5 × 7² = 245.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0374",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "9، 22، 12، 66، 15، 198، 18، ؟ المواضع الفردية متتالية حسابية بفرق غير صفري، والمواضع الزوجية متتالية هندسية بنسبة أكبر من 1. ما العدد التالي؟",
      "choices": [
        "22",
        "66",
        "593",
        "594"
      ],
      "answer": 3,
      "why": "فرق المواضع الفردية 3، ونسبة الزوجية 3؛ المطلوب من المواضع الزوجية، وبعد 198 يأتي 594 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0375",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "225، 169، 121، 81، ؟ الحدود مربعات أعداد صحيحة موجبة تتحرك بخطوة ثابتة غير صفرية. ما العدد التالي؟",
      "choices": [
        "16",
        "25",
        "36",
        "49"
      ],
      "answer": 3,
      "why": "الجذور التربيعية الموجبة هي 15، 13، 11، 9، وخطوتها -2؛ التالي 7، و7² = 49.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0376",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "1، 2، 10، 37، ؟ الفروق بين الحدود المتجاورة مكعبات أعداد صحيحة موجبة متتالية تصاعديا. ما العدد التالي؟",
      "choices": [
        "45",
        "101",
        "253",
        "380"
      ],
      "answer": 1,
      "why": "الفروق 1، 8، 27 هي مكعبات 1، 2، 3؛ التالي 4³ = 64، ثم 37 + 64 = 101.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0377",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "10، 31، 94، 283، ؟ كل حد يساوي سابقه مضروبا في عدد صحيح ثابت أكبر من 1، ثم مضافا إليه عدد صحيح ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "566",
        "567",
        "568",
        "850"
      ],
      "answer": 3,
      "why": "في كل انتقال نضرب في 3 ثم نضيف 1؛ لذلك 3 × 283 + 1 = 850.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0378",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "7، 10، 18، 21، 29، 32، ؟ الفروق بين الحدود المتجاورة تتناوب بين قيمتين ثابتتين مختلفتين غير صفريتين. ما العدد التالي؟",
      "choices": [
        "40",
        "41",
        "42",
        "48"
      ],
      "answer": 0,
      "why": "الفروق تتناوب بين 3 و8؛ الدور الآن لإضافة 8، لذلك 32 + 8 = 40.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0379",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "3، 22، 59، ؟ الحدود مكعبات أعداد صحيحة موجبة متتالية تصاعديا، أضيف إليها عدد صحيح ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "3",
        "22",
        "59",
        "120"
      ],
      "answer": 3,
      "why": "الحدود هي المكعبات ابتداء من 2³ مع إضافة -5؛ لذلك التالي 5³ − 5 = 120.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0380",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "9، 15، 27، 51، 99، ؟ الفروق بين الحدود المتجاورة موجبة، ونسبة كل فرق إلى سابقه عدد صحيح ثابت أكبر من 1. ما العدد التالي؟",
      "choices": [
        "147",
        "193",
        "194",
        "195"
      ],
      "answer": 3,
      "why": "الفروق هي 6، 12، 24، 48، ونسبتها 2؛ الفرق التالي 96، فيكون 99 + 96 = 195.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0381",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "29، 40، 53، 68، ؟ الحدود مربعات أعداد صحيحة موجبة متتالية تصاعديا، أضيف إليها عدد صحيح ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "85",
        "104",
        "125",
        "148"
      ],
      "answer": 0,
      "why": "الحدود هي المربعات ابتداء من 5² مع إضافة 4؛ لذلك التالي 9² + 4 = 85.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0382",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "3، 5، 9، 17، 33، ؟ الفروق بين الحدود المتجاورة موجبة، ونسبة كل فرق إلى سابقه عدد صحيح ثابت أكبر من 1. ما العدد التالي؟",
      "choices": [
        "65",
        "66",
        "97",
        "113"
      ],
      "answer": 0,
      "why": "الفروق هي 2، 4، 8، 16، ونسبتها 2؛ الفرق التالي 32، فيكون 33 + 32 = 65.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0384",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "20، 31، 44، 59، ؟ الحدود مربعات أعداد صحيحة موجبة متتالية تصاعديا، أضيف إليها عدد صحيح ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "44",
        "76",
        "116",
        "139"
      ],
      "answer": 1,
      "why": "الحدود هي المربعات ابتداء من 5² مع إضافة -5؛ لذلك التالي 9² − 5 = 76.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0385",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "15، 19، 16، 20، 17، 21، ؟ الفروق بين الحدود المتجاورة تتناوب بين قيمتين ثابتتين مختلفتين غير صفريتين. ما العدد التالي؟",
      "choices": [
        "15",
        "18",
        "21",
        "24"
      ],
      "answer": 1,
      "why": "الفروق تتناوب بين 4 و-3؛ الدور الآن لإضافة -3، لذلك 21 − 3 = 18.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0386",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "11، 14، 23، 50، 131، ؟ الفروق بين الحدود المتجاورة موجبة، ونسبة كل فرق إلى سابقه عدد صحيح ثابت أكبر من 1. ما العدد التالي؟",
      "choices": [
        "374",
        "393",
        "455",
        "536"
      ],
      "answer": 0,
      "why": "الفروق هي 3، 9، 27، 81، ونسبتها 3؛ الفرق التالي 243، فيكون 131 + 243 = 374.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0389",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "12، 60، 300، ؟ نسبة كل حد إلى سابقه ثابتة وأكبر من 1. ما العدد التالي؟",
      "choices": [
        "600",
        "900",
        "1200",
        "1500"
      ],
      "answer": 3,
      "why": "كل حد ناتج ضرب سابقه في 5؛ إذن 300 × 5 = 1500.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0390",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "ل، غ، ض، ز، ؟ الحروف تتحرك بخطوة ثابتة غير صفرية في الترتيب الهجائي العربي المعتاد، من دون التفاف عند طرفيه. ما الحرف التالي؟",
      "choices": [
        "ذ",
        "ز",
        "خ",
        "ح"
      ],
      "answer": 2,
      "why": "مواضع الحروف هي 23، 19، 15، 11، وخطوتها -4؛ الموضع التالي 7 وحرفه خ.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0391",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "5، 6، 11، 17، 28، 45، ؟ من الحد الثالث، كل حد يساوي مجموع الحدين السابقين. ما العدد التالي؟",
      "choices": [
        "56",
        "73",
        "84",
        "90"
      ],
      "answer": 1,
      "why": "نجمع الحدين الأخيرين: 28 + 45 = 73.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0392",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "9، 27، 29، 87، 89، ؟ تتناوب عمليتا الضرب في عدد صحيح ثابت أكبر من 1 والجمع مع عدد صحيح ثابت غير صفري، بدءا بالضرب. ما العدد التالي؟",
      "choices": [
        "267",
        "268",
        "269",
        "270"
      ],
      "answer": 0,
      "why": "تتناوب عمليتا الضرب في 3 وإضافة 2؛ الدور الآن للضرب، لذلك 89 × 3 = 267.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0393",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "السبت، الثلاثاء، الجمعة، الاثنين، ؟ الأيام تسير إلى الأمام بخطوة ثابتة من 1 إلى 6 أيام، مع العودة بعد الجمعة إلى السبت. ما اليوم التالي؟",
      "choices": [
        "الأحد",
        "الخميس",
        "الجمعة",
        "الأربعاء"
      ],
      "answer": 1,
      "why": "نتقدم 3 أيام في كل انتقال؛ من الاثنين نصل إلى الخميس مع دوران الأسبوع.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0394",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "5، 1، 8، 25، 83، ؟ من الحد الثالث، كل حد يساوي حاصل ضرب سابقه في 3، مضافا إليه ما قبله. ما العدد التالي؟",
      "choices": [
        "216",
        "241",
        "274",
        "324"
      ],
      "answer": 2,
      "why": "نضرب الحد الأخير في 3 ثم نضيف ما قبله: 3 × 83 + 25 = 274.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0395",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "5، 14، 11، 16، 17، 18، 23، ؟ المواضع الفردية متتالية حسابية، والمواضع الزوجية متتالية حسابية أخرى؛ والفرق في كل منهما غير صفري. ما العدد التالي؟",
      "choices": [
        "16",
        "18",
        "19",
        "20"
      ],
      "answer": 3,
      "why": "فرق المواضع الفردية 6، وفرق الزوجية 2؛ المطلوب من المواضع الزوجية، وبعد 18 يأتي 20 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0396",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "71، 73، 79، 83، ؟ الحدود أعداد أولية متتالية تصاعديا. ما العدد التالي؟",
      "choices": [
        "73",
        "79",
        "88",
        "89"
      ],
      "answer": 3,
      "why": "الأعداد المعروضة أولية متتالية؛ أول عدد أولي بعد 83 هو 89.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0397",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "6، 25، 82، 253، ؟ كل حد يساوي سابقه مضروبا في عدد صحيح ثابت أكبر من 1، ثم مضافا إليه عدد صحيح ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "520",
        "766",
        "1012",
        "1019"
      ],
      "answer": 1,
      "why": "في كل انتقال نضرب في 3 ثم نضيف 7؛ لذلك 3 × 253 + 7 = 766.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0398",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "13، 18، 26، 54، 52، 162، ؟ المواضع الفردية متتالية هندسية، والمواضع الزوجية متتالية هندسية أخرى؛ والنسبة في كل منهما أكبر من 1. ما العدد التالي؟",
      "choices": [
        "26",
        "104",
        "208",
        "416"
      ],
      "answer": 1,
      "why": "نسبة المواضع الفردية 2، ونسبة الزوجية 3؛ المطلوب من المواضع الفردية، وبعد 52 يأتي 104 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0399",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "9، 15، 23، 29، 37، ؟ الفروق بين الحدود المتجاورة تتناوب بين قيمتين ثابتتين مختلفتين غير صفريتين. ما العدد التالي؟",
      "choices": [
        "31",
        "37",
        "42",
        "43"
      ],
      "answer": 3,
      "why": "الفروق تتناوب بين 6 و8؛ الدور الآن لإضافة 6، لذلك 37 + 6 = 43.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0400",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "24، 25، 29، 34، 35، 39، 44، 45، ؟ الفروق تتكرر في دورة من ثلاث قيم ثابتة مختلفة غير صفرية، بالترتيب نفسه. ما العدد التالي؟",
      "choices": [
        "46",
        "48",
        "49",
        "50"
      ],
      "answer": 2,
      "why": "الفروق تتكرر بالترتيب 1، 4، 5؛ الدور الآن لإضافة 4، لذلك 45 + 4 = 49.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0403",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "الجمعة، الأحد، الثلاثاء، الخميس، ؟ الأيام تسير إلى الأمام بخطوة ثابتة من 1 إلى 6 أيام، مع العودة بعد الجمعة إلى السبت. ما اليوم التالي؟",
      "choices": [
        "الأحد",
        "الاثنين",
        "السبت",
        "الثلاثاء"
      ],
      "answer": 2,
      "why": "نتقدم يومين في كل انتقال؛ من الخميس نصل إلى السبت مع دوران الأسبوع.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0404",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "162، 54، 18، ؟ نسبة كل حد إلى سابقه ثابتة وبين 0 و1. ما العدد التالي؟",
      "choices": [
        "3",
        "4",
        "5",
        "6"
      ],
      "answer": 3,
      "why": "كل حد ناتج قسمة سابقه على 3؛ إذن 18 ÷ 3 = 6.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0405",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "1728، 729، 216، ؟ الحدود مكعبات أعداد صحيحة موجبة تتحرك بخطوة ثابتة غير صفرية. ما العدد التالي؟",
      "choices": [
        "27",
        "30",
        "64",
        "125"
      ],
      "answer": 0,
      "why": "الجذور التكعيبية الموجبة هي 12، 9، 6، وخطوتها -3؛ التالي 3، و3³ = 27.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0406",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "1، 6، 4، 11، 21، 36، ؟ من الحد الرابع، كل حد يساوي مجموع الحدود الثلاثة السابقة مباشرة. ما العدد التالي؟",
      "choices": [
        "32",
        "47",
        "57",
        "68"
      ],
      "answer": 3,
      "why": "نجمع آخر ثلاثة حدود: 11 + 21 + 36 = 68.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0408",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "5، 2، 11، 35، 116، ؟ من الحد الثالث، كل حد يساوي حاصل ضرب سابقه في 3، مضافا إليه ما قبله. ما العدد التالي؟",
      "choices": [
        "302",
        "337",
        "383",
        "453"
      ],
      "answer": 2,
      "why": "نضرب الحد الأخير في 3 ثم نضيف ما قبله: 3 × 116 + 35 = 383.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0409",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "7، 14، 19، 18، 36، 41، 40، 80، ؟ تتكرر دورة: الضرب في عدد صحيح ثابت أكبر من 1، ثم إضافة عدد صحيح موجب ثابت، ثم طرح عدد صحيح موجب ثابت مختلف عنه. ما العدد التالي؟",
      "choices": [
        "85",
        "86",
        "87",
        "160"
      ],
      "answer": 0,
      "why": "الدورة هي ×2، ثم +5، ثم −1؛ العملية التالية إضافة 5، وناتجها 85.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0410",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "24، 31، 30، 37، 36، 43، ؟ الفروق بين الحدود المتجاورة تتناوب بين قيمتين ثابتتين مختلفتين غير صفريتين. ما العدد التالي؟",
      "choices": [
        "41",
        "42",
        "43",
        "44"
      ],
      "answer": 1,
      "why": "الفروق تتناوب بين 7 و-1؛ الدور الآن لإضافة -1، لذلك 43 − 1 = 42.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0411",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "36، 28، 21، 15، ؟ الحدود أعداد مثلثية متتالية بخطوة ثابتة في ترتيبها؛ والعدد المثلثي هو مجموع الأعداد من 1 إلى عدد صحيح موجب. ما العدد التالي؟",
      "choices": [
        "1",
        "3",
        "10",
        "21"
      ],
      "answer": 2,
      "why": "ترتيب الأعداد المثلثية المعروضة هو 8، 7، 6، 5؛ التالي في الترتيب 4، وقيمته 4 × 5 ÷ 2 = 10.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0412",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "92، 75، 58، 41، ؟ الفروق بين الحدود المتجاورة ثابتة وسالبة. ما العدد التالي؟",
      "choices": [
        "7",
        "23",
        "24",
        "75"
      ],
      "answer": 2,
      "why": "الفرق الثابت هو -17؛ لذلك 41 − 17 = 24.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0413",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "16، 36، 64، 100، ؟ الحدود مربعات أعداد صحيحة موجبة تتحرك بخطوة ثابتة غير صفرية. ما العدد التالي؟",
      "choices": [
        "81",
        "144",
        "196",
        "225"
      ],
      "answer": 1,
      "why": "الجذور التربيعية الموجبة هي 4، 6، 8، 10، وخطوتها 2؛ التالي 12، و12² = 144.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0414",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "ح، ج، ث، ت، ؟ الحروف تتحرك بخطوة ثابتة غير صفرية في الترتيب الهجائي العربي المعتاد، من دون التفاف عند طرفيه. ما الحرف التالي؟",
      "choices": [
        "ت",
        "ب",
        "ج",
        "ث"
      ],
      "answer": 1,
      "why": "مواضع الحروف هي 6، 5، 4، 3، وخطوتها -1؛ الموضع التالي 2 وحرفه ب.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0415",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "3، 11، 24، 42، 65، ؟ الفروق بين الحدود المتجاورة تتغير بمقدار ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "78",
        "83",
        "93",
        "103"
      ],
      "answer": 2,
      "why": "الفروق هي 8، 13، 18، 23، وتتغير بمقدار 5؛ الفرق التالي 28، فيكون 65 + 28 = 93.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0416",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "6، 9، 16، 27، 42، ؟ الفروق بين الحدود المتجاورة تتغير بمقدار ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "49",
        "53",
        "57",
        "61"
      ],
      "answer": 3,
      "why": "الفروق هي 3، 7، 11، 15، وتتغير بمقدار 4؛ الفرق التالي 19، فيكون 42 + 19 = 61.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0417",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "السبت، الأحد، الاثنين، الثلاثاء، ؟ الأيام تسير إلى الأمام بخطوة ثابتة من 1 إلى 6 أيام، مع العودة بعد الجمعة إلى السبت. ما اليوم التالي؟",
      "choices": [
        "الخميس",
        "الثلاثاء",
        "الأحد",
        "الأربعاء"
      ],
      "answer": 3,
      "why": "نتقدم يوما واحدا في كل انتقال؛ من الثلاثاء نصل إلى الأربعاء مع دوران الأسبوع.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0418",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "5، 1، 6، 7، 13، 20، ؟ من الحد الثالث، كل حد يساوي مجموع الحدين السابقين. ما العدد التالي؟",
      "choices": [
        "13",
        "20",
        "26",
        "33"
      ],
      "answer": 3,
      "why": "نجمع الحدين الأخيرين: 13 + 20 = 33.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0419",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "5، 4، 9، 13، 22، 35، ؟ من الحد الثالث، كل حد يساوي مجموع الحدين السابقين. ما العدد التالي؟",
      "choices": [
        "57",
        "66",
        "70",
        "101"
      ],
      "answer": 0,
      "why": "نجمع الحدين الأخيرين: 22 + 35 = 57.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0420",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "6، 7، 10، 12، 14، 17، 18، ؟ المواضع الفردية متتالية حسابية، والمواضع الزوجية متتالية حسابية أخرى؛ والفرق في كل منهما غير صفري. ما العدد التالي؟",
      "choices": [
        "12",
        "22",
        "27",
        "32"
      ],
      "answer": 1,
      "why": "فرق المواضع الفردية 4، وفرق الزوجية 5؛ المطلوب من المواضع الزوجية، وبعد 17 يأتي 22 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0421",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "14، 21، 30، 41، ؟ الحدود مربعات أعداد صحيحة موجبة متتالية تصاعديا، أضيف إليها عدد صحيح ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "30",
        "54",
        "86",
        "105"
      ],
      "answer": 1,
      "why": "الحدود هي المربعات ابتداء من 3² مع إضافة 5؛ لذلك التالي 7² + 5 = 54.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0422",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "11، 16، 20، 27، 32، 36، 43، ؟ الفروق تتكرر في دورة من ثلاث قيم ثابتة مختلفة غير صفرية، بالترتيب نفسه. ما العدد التالي؟",
      "choices": [
        "43",
        "47",
        "48",
        "49"
      ],
      "answer": 2,
      "why": "الفروق تتكرر بالترتيب 5، 4، 7؛ الدور الآن لإضافة 5، لذلك 43 + 5 = 48.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0423",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "9، 16، 16، 22، 25، 28، 36، ؟ المواضع الفردية مربعات أعداد صحيحة موجبة متتالية تصاعديا، والمواضع الزوجية متتالية حسابية بفرق غير صفري. ما العدد التالي؟",
      "choices": [
        "16",
        "22",
        "34",
        "46"
      ],
      "answer": 2,
      "why": "المواضع الفردية مربعات 3، 4، 5، 6، وفرق الزوجية 6؛ المطلوب من المواضع الزوجية، وبعد 28 يأتي 34 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0424",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "24، 31، 37، 44، 50، ؟ الفروق بين الحدود المتجاورة تتناوب بين قيمتين ثابتتين مختلفتين غير صفريتين. ما العدد التالي؟",
      "choices": [
        "57",
        "58",
        "59",
        "64"
      ],
      "answer": 0,
      "why": "الفروق تتناوب بين 7 و6؛ الدور الآن لإضافة 7، لذلك 50 + 7 = 57.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0425",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "343، 512، 729، ؟ الحدود مكعبات أعداد صحيحة موجبة تتحرك بخطوة ثابتة غير صفرية. ما العدد التالي؟",
      "choices": [
        "1000",
        "1001",
        "1728",
        "2197"
      ],
      "answer": 0,
      "why": "الجذور التكعيبية الموجبة هي 7، 8، 9، وخطوتها 1؛ التالي 10، و10³ = 1000.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0426",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "12، 30، 48، 66، ؟ الفروق بين الحدود المتجاورة ثابتة وموجبة. ما العدد التالي؟",
      "choices": [
        "30",
        "48",
        "66",
        "84"
      ],
      "answer": 3,
      "why": "الفرق الثابت هو 18؛ لذلك 66 + 18 = 84.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0427",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "19، 18، 17، 16، ؟ الفروق بين الحدود المتجاورة ثابتة وسالبة. ما العدد التالي؟",
      "choices": [
        "12",
        "13",
        "15",
        "18"
      ],
      "answer": 2,
      "why": "الفرق الثابت هو -1؛ لذلك 16 − 1 = 15.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0428",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "55، 70، 87، 106، ؟ الحدود مربعات أعداد صحيحة موجبة متتالية تصاعديا، أضيف إليها عدد صحيح ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "127",
        "150",
        "175",
        "202"
      ],
      "answer": 0,
      "why": "الحدود هي المربعات ابتداء من 7² مع إضافة 6؛ لذلك التالي 11² + 6 = 127.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0429",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "23، 25، 29، 30، 32، 36، 37، 39، ؟ الفروق تتكرر في دورة من ثلاث قيم ثابتة مختلفة غير صفرية، بالترتيب نفسه. ما العدد التالي؟",
      "choices": [
        "43",
        "44",
        "45",
        "46"
      ],
      "answer": 0,
      "why": "الفروق تتكرر بالترتيب 2، 4، 1؛ الدور الآن لإضافة 4، لذلك 39 + 4 = 43.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0430",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "16، 18، 24، 26، 32، ؟ الفروق بين الحدود المتجاورة تتناوب بين قيمتين ثابتتين مختلفتين غير صفريتين. ما العدد التالي؟",
      "choices": [
        "30",
        "32",
        "33",
        "34"
      ],
      "answer": 3,
      "why": "الفروق تتناوب بين 2 و6؛ الدور الآن لإضافة 2، لذلك 32 + 2 = 34.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0431",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "105، 86، 67، 48، ؟ الفروق بين الحدود المتجاورة ثابتة وسالبة. ما العدد التالي؟",
      "choices": [
        "10",
        "27",
        "28",
        "29"
      ],
      "answer": 3,
      "why": "الفرق الثابت هو -19؛ لذلك 48 − 19 = 29.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0432",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "14، 15، 18، 17، 22، 19، ؟ المواضع الفردية متتالية حسابية، والمواضع الزوجية متتالية حسابية أخرى؛ والفرق في كل منهما غير صفري. ما العدد التالي؟",
      "choices": [
        "26",
        "27",
        "34",
        "38"
      ],
      "answer": 0,
      "why": "فرق المواضع الفردية 4، وفرق الزوجية 2؛ المطلوب من المواضع الفردية، وبعد 22 يأتي 26 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0433",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "96، 48، 24، 12، ؟ نسبة كل حد إلى سابقه ثابتة وبين 0 و1. ما العدد التالي؟",
      "choices": [
        "3",
        "6",
        "8",
        "10"
      ],
      "answer": 1,
      "why": "كل حد ناتج قسمة سابقه على 2؛ إذن 12 ÷ 2 = 6.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0434",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "9، 21، 45، 93، ؟ كل حد يساوي سابقه مضروبا في عدد صحيح ثابت أكبر من 1، ثم مضافا إليه عدد صحيح ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "93",
        "99",
        "187",
        "189"
      ],
      "answer": 3,
      "why": "في كل انتقال نضرب في 2 ثم نضيف 3؛ لذلك 2 × 93 + 3 = 189.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0435",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "540، 180، 60، ؟ نسبة كل حد إلى سابقه ثابتة وبين 0 و1. ما العدد التالي؟",
      "choices": [
        "12",
        "15",
        "20",
        "30"
      ],
      "answer": 2,
      "why": "كل حد ناتج قسمة سابقه على 3؛ إذن 60 ÷ 3 = 20.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0436",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "14، 25، 36، 47، ؟ الفروق بين الحدود المتجاورة ثابتة وموجبة. ما العدد التالي؟",
      "choices": [
        "25",
        "58",
        "80",
        "91"
      ],
      "answer": 1,
      "why": "الفرق الثابت هو 11؛ لذلك 47 + 11 = 58.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0437",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "52، 67، 84، 103، ؟ الحدود مربعات أعداد صحيحة موجبة متتالية تصاعديا، أضيف إليها عدد صحيح ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "124",
        "147",
        "172",
        "199"
      ],
      "answer": 0,
      "why": "الحدود هي المربعات ابتداء من 7² مع إضافة 3؛ لذلك التالي 11² + 3 = 124.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0438",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "22، 26، 30، 34، ؟ الفروق بين الحدود المتجاورة ثابتة وموجبة. ما العدد التالي؟",
      "choices": [
        "26",
        "38",
        "46",
        "50"
      ],
      "answer": 1,
      "why": "الفرق الثابت هو 4؛ لذلك 34 + 4 = 38.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0439",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "1000، 512، 216، ؟ الحدود مكعبات أعداد صحيحة موجبة تتحرك بخطوة ثابتة غير صفرية. ما العدد التالي؟",
      "choices": [
        "1",
        "8",
        "27",
        "64"
      ],
      "answer": 3,
      "why": "الجذور التكعيبية الموجبة هي 10، 8، 6، وخطوتها -2؛ التالي 4، و4³ = 64.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0440",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "25، 75، 225، ؟ نسبة كل حد إلى سابقه ثابتة وأكبر من 1. ما العدد التالي؟",
      "choices": [
        "300",
        "450",
        "675",
        "900"
      ],
      "answer": 2,
      "why": "كل حد ناتج ضرب سابقه في 3؛ إذن 225 × 3 = 675.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0441",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "94، 79، 64، 49، ؟ الفروق بين الحدود المتجاورة ثابتة وسالبة. ما العدد التالي؟",
      "choices": [
        "4",
        "19",
        "34",
        "79"
      ],
      "answer": 2,
      "why": "الفرق الثابت هو -15؛ لذلك 49 − 15 = 34.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0442",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "15، 21، 20، 63، 25، 189، ؟ المواضع الفردية متتالية حسابية بفرق غير صفري، والمواضع الزوجية متتالية هندسية بنسبة أكبر من 1. ما العدد التالي؟",
      "choices": [
        "20",
        "30",
        "40",
        "45"
      ],
      "answer": 1,
      "why": "فرق المواضع الفردية 5، ونسبة الزوجية 3؛ المطلوب من المواضع الفردية، وبعد 25 يأتي 30 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0443",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "125، 216، 343، ؟ الحدود مكعبات أعداد صحيحة موجبة تتحرك بخطوة ثابتة غير صفرية. ما العدد التالي؟",
      "choices": [
        "216",
        "512",
        "1000",
        "1331"
      ],
      "answer": 1,
      "why": "الجذور التكعيبية الموجبة هي 5، 6، 7، وخطوتها 1؛ التالي 8، و8³ = 512.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0444",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "8، 24، 27، 81، 84، ؟ تتناوب عمليتا الضرب في عدد صحيح ثابت أكبر من 1 والجمع مع عدد صحيح ثابت غير صفري، بدءا بالضرب. ما العدد التالي؟",
      "choices": [
        "252",
        "253",
        "254",
        "255"
      ],
      "answer": 0,
      "why": "تتناوب عمليتا الضرب في 3 وإضافة 3؛ الدور الآن للضرب، لذلك 84 × 3 = 252.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0445",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "ش، ر، خ، ث، ؟ الحروف تتحرك بخطوة ثابتة غير صفرية في الترتيب الهجائي العربي المعتاد، من دون التفاف عند طرفيه. ما الحرف التالي؟",
      "choices": [
        "ا",
        "ت",
        "ج",
        "ث"
      ],
      "answer": 0,
      "why": "مواضع الحروف هي 13، 10، 7، 4، وخطوتها -3؛ الموضع التالي 1 وحرفه ا.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0446",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "7، 21، 22، 66، 67، 201، ؟ تتناوب عمليتا الضرب في عدد صحيح ثابت أكبر من 1 والجمع مع عدد صحيح ثابت غير صفري، بدءا بالضرب. ما العدد التالي؟",
      "choices": [
        "202",
        "203",
        "205",
        "603"
      ],
      "answer": 0,
      "why": "تتناوب عمليتا الضرب في 3 وإضافة 1؛ الدور الآن للجمع، لذلك 201 + 1 = 202.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0447",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "2، 3، 6، 11، 20، 37، ؟ من الحد الرابع، كل حد يساوي مجموع الحدود الثلاثة السابقة مباشرة. ما العدد التالي؟",
      "choices": [
        "68",
        "74",
        "88",
        "105"
      ],
      "answer": 0,
      "why": "نجمع آخر ثلاثة حدود: 11 + 20 + 37 = 68.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0448",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "35، 72، 133، ؟ الحدود مكعبات أعداد صحيحة موجبة متتالية تصاعديا، أضيف إليها عدد صحيح ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "35",
        "72",
        "224",
        "520"
      ],
      "answer": 2,
      "why": "الحدود هي المكعبات ابتداء من 3³ مع إضافة 8؛ لذلك التالي 6³ + 8 = 224.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0449",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "25، 6، 36، 8، 49، 10، ؟ المواضع الفردية مربعات أعداد صحيحة موجبة متتالية تصاعديا، والمواضع الزوجية متتالية حسابية بفرق غير صفري. ما العدد التالي؟",
      "choices": [
        "25",
        "36",
        "63",
        "64"
      ],
      "answer": 3,
      "why": "المواضع الفردية مربعات 5، 6، 7، وفرق الزوجية 2؛ المطلوب من المواضع الفردية، وبعد 49 يأتي 64 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0450",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "9، 12، 18، 30، 54، ؟ الفروق بين الحدود المتجاورة موجبة، ونسبة كل فرق إلى سابقه عدد صحيح ثابت أكبر من 1. ما العدد التالي؟",
      "choices": [
        "102",
        "108",
        "150",
        "174"
      ],
      "answer": 0,
      "why": "الفروق هي 3، 6، 12، 24، ونسبتها 2؛ الفرق التالي 48، فيكون 54 + 48 = 102.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0451",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "13، 15، 21، 39، 93، ؟ الفروق بين الحدود المتجاورة موجبة، ونسبة كل فرق إلى سابقه عدد صحيح ثابت أكبر من 1. ما العدد التالي؟",
      "choices": [
        "201",
        "255",
        "279",
        "363"
      ],
      "answer": 1,
      "why": "الفروق هي 2، 6، 18، 54، ونسبتها 3؛ الفرق التالي 162، فيكون 93 + 162 = 255.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0452",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "18، 28، 38، 48، ؟ الفروق بين الحدود المتجاورة ثابتة وموجبة. ما العدد التالي؟",
      "choices": [
        "58",
        "68",
        "78",
        "88"
      ],
      "answer": 0,
      "why": "الفرق الثابت هو 10؛ لذلك 48 + 10 = 58.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0453",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "98، 128، 162، 200، ؟ الحدود مربعات أعداد صحيحة موجبة متتالية تصاعديا، ضربت في عدد صحيح ثابت أكبر من 1. ما العدد التالي؟",
      "choices": [
        "128",
        "162",
        "242",
        "338"
      ],
      "answer": 2,
      "why": "كل حد مربع عدد متتال مضروبا في 2؛ التالي 2 × 11² = 242.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0454",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "الخميس، الأحد، الأربعاء، السبت، ؟ الأيام تسير إلى الأمام بخطوة ثابتة من 1 إلى 6 أيام، مع العودة بعد الجمعة إلى السبت. ما اليوم التالي؟",
      "choices": [
        "الاثنين",
        "الجمعة",
        "الخميس",
        "الثلاثاء"
      ],
      "answer": 3,
      "why": "نتقدم 3 أيام في كل انتقال؛ من السبت نصل إلى الثلاثاء مع دوران الأسبوع.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0455",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "3، 23، 7، 69، 11، 207، ؟ المواضع الفردية متتالية حسابية بفرق غير صفري، والمواضع الزوجية متتالية هندسية بنسبة أكبر من 1. ما العدد التالي؟",
      "choices": [
        "3",
        "7",
        "14",
        "15"
      ],
      "answer": 3,
      "why": "فرق المواضع الفردية 4، ونسبة الزوجية 3؛ المطلوب من المواضع الفردية، وبعد 11 يأتي 15 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0456",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "4، 25، 64، 121، ؟ الحدود مربعات أعداد صحيحة موجبة تتحرك بخطوة ثابتة غير صفرية. ما العدد التالي؟",
      "choices": [
        "144",
        "169",
        "196",
        "256"
      ],
      "answer": 2,
      "why": "الجذور التربيعية الموجبة هي 2، 5، 8، 11، وخطوتها 3؛ التالي 14، و14² = 196.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0457",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "10، 25، 55، 115، ؟ كل حد يساوي سابقه مضروبا في عدد صحيح ثابت أكبر من 1، ثم مضافا إليه عدد صحيح ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "125",
        "235",
        "345",
        "350"
      ],
      "answer": 1,
      "why": "في كل انتقال نضرب في 2 ثم نضيف 5؛ لذلك 2 × 115 + 5 = 235.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0458",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "7، 14، 15، 30، 31، ؟ تتناوب عمليتا الضرب في عدد صحيح ثابت أكبر من 1 والجمع مع عدد صحيح ثابت غير صفري، بدءا بالضرب. ما العدد التالي؟",
      "choices": [
        "61",
        "62",
        "63",
        "64"
      ],
      "answer": 1,
      "why": "تتناوب عمليتا الضرب في 2 وإضافة 1؛ الدور الآن للضرب، لذلك 31 × 2 = 62.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0459",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "8، 19، 52، 151، ؟ كل حد يساوي سابقه مضروبا في عدد صحيح ثابت أكبر من 1، ثم مضافا إليه عدد صحيح ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "302",
        "448",
        "594",
        "599"
      ],
      "answer": 1,
      "why": "في كل انتقال نضرب في 3 ثم نضيف -5؛ لذلك 3 × 151 − 5 = 448.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0460",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "12، 26، 40، 54، ؟ الفروق بين الحدود المتجاورة ثابتة وموجبة. ما العدد التالي؟",
      "choices": [
        "26",
        "54",
        "68",
        "96"
      ],
      "answer": 2,
      "why": "الفرق الثابت هو 14؛ لذلك 54 + 14 = 68.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0461",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "84، 42، 48، 24، 30، ؟ تتناوب عمليتا القسمة على عدد صحيح ثابت أكبر من 1 والجمع مع عدد صحيح ثابت غير صفري، بدءا بالقسمة. ما العدد التالي؟",
      "choices": [
        "15",
        "17",
        "21",
        "30"
      ],
      "answer": 0,
      "why": "تتناوب القسمة على 2 وإضافة 6؛ الدور الآن للقسمة: 30 ÷ 2 = 15.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0462",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "11، 13، 17، 19، ؟ الحدود أعداد أولية متتالية تصاعديا. ما العدد التالي؟",
      "choices": [
        "13",
        "17",
        "22",
        "23"
      ],
      "answer": 3,
      "why": "الأعداد المعروضة أولية متتالية؛ أول عدد أولي بعد 19 هو 23.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0463",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "150، 216، 294، 384، ؟ الحدود مربعات أعداد صحيحة موجبة متتالية تصاعديا، ضربت في عدد صحيح ثابت أكبر من 1. ما العدد التالي؟",
      "choices": [
        "486",
        "492",
        "726",
        "864"
      ],
      "answer": 0,
      "why": "كل حد مربع عدد متتال مضروبا في 6؛ التالي 6 × 9² = 486.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0464",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "9، 21، 33، 45، ؟ الفروق بين الحدود المتجاورة ثابتة وموجبة. ما العدد التالي؟",
      "choices": [
        "21",
        "45",
        "57",
        "81"
      ],
      "answer": 2,
      "why": "الفرق الثابت هو 12؛ لذلك 45 + 12 = 57.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0465",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "5، 2، 7، 9، 16، 25، ؟ من الحد الثالث، كل حد يساوي مجموع الحدين السابقين. ما العدد التالي؟",
      "choices": [
        "16",
        "32",
        "41",
        "48"
      ],
      "answer": 2,
      "why": "نجمع الحدين الأخيرين: 16 + 25 = 41.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0466",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "7، 5، 12، 17، 29، 46، ؟ من الحد الثالث، كل حد يساوي مجموع الحدين السابقين. ما العدد التالي؟",
      "choices": [
        "29",
        "46",
        "58",
        "75"
      ],
      "answer": 3,
      "why": "نجمع الحدين الأخيرين: 29 + 46 = 75.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0467",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "7، 8، 12، 21، ؟ الفروق بين الحدود المتجاورة مربعات أعداد صحيحة موجبة متتالية تصاعديا. ما العدد التالي؟",
      "choices": [
        "22",
        "25",
        "37",
        "57"
      ],
      "answer": 2,
      "why": "الفروق 1، 4، 9 هي مربعات 1، 2، 3؛ التالي 4² = 16، ثم 21 + 16 = 37.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0468",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "9، 36، 81، 144، ؟ الحدود مربعات أعداد صحيحة موجبة تتحرك بخطوة ثابتة غير صفرية. ما العدد التالي؟",
      "choices": [
        "225",
        "228",
        "289",
        "324"
      ],
      "answer": 0,
      "why": "الجذور التربيعية الموجبة هي 3، 6، 9، 12، وخطوتها 3؛ التالي 15، و15² = 225.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0470",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "2، 9، 18، 29، ؟ الحدود مربعات أعداد صحيحة موجبة متتالية تصاعديا، أضيف إليها عدد صحيح ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "18",
        "42",
        "74",
        "93"
      ],
      "answer": 1,
      "why": "الحدود هي المربعات ابتداء من 3² مع إضافة -7؛ لذلك التالي 7² − 7 = 42.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0471",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "13، 24، 17، 26، 21، 28، 25، ؟ المواضع الفردية متتالية حسابية، والمواضع الزوجية متتالية حسابية أخرى؛ والفرق في كل منهما غير صفري. ما العدد التالي؟",
      "choices": [
        "24",
        "28",
        "29",
        "30"
      ],
      "answer": 3,
      "why": "فرق المواضع الفردية 4، وفرق الزوجية 2؛ المطلوب من المواضع الزوجية، وبعد 28 يأتي 30 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0472",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "7، 12، 22، 42، 82، ؟ الفروق بين الحدود المتجاورة موجبة، ونسبة كل فرق إلى سابقه عدد صحيح ثابت أكبر من 1. ما العدد التالي؟",
      "choices": [
        "122",
        "162",
        "242",
        "282"
      ],
      "answer": 1,
      "why": "الفروق هي 5، 10، 20، 40، ونسبتها 2؛ الفرق التالي 80، فيكون 82 + 80 = 162.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0473",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "ط، ص، س، ر، ؟ الحروف تتحرك بخطوة ثابتة غير صفرية في الترتيب الهجائي العربي المعتاد، من دون التفاف عند طرفيه. ما الحرف التالي؟",
      "choices": [
        "خ",
        "ز",
        "ر",
        "د"
      ],
      "answer": 3,
      "why": "مواضع الحروف هي 16، 14، 12، 10، وخطوتها -2؛ الموضع التالي 8 وحرفه د.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0474",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "5، 15، 16، 48، 49، 147، ؟ تتناوب عمليتا الضرب في عدد صحيح ثابت أكبر من 1 والجمع مع عدد صحيح ثابت غير صفري، بدءا بالضرب. ما العدد التالي؟",
      "choices": [
        "147",
        "148",
        "149",
        "151"
      ],
      "answer": 1,
      "why": "تتناوب عمليتا الضرب في 3 وإضافة 1؛ الدور الآن للجمع، لذلك 147 + 1 = 148.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0475",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "6، 8، 18، 16، 54، 32، 162، ؟ المواضع الفردية متتالية هندسية، والمواضع الزوجية متتالية هندسية أخرى؛ والنسبة في كل منهما أكبر من 1. ما العدد التالي؟",
      "choices": [
        "8",
        "16",
        "64",
        "128"
      ],
      "answer": 2,
      "why": "نسبة المواضع الفردية 3، ونسبة الزوجية 2؛ المطلوب من المواضع الزوجية، وبعد 32 يأتي 64 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0476",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "17، 19، 18، 21، 23، 22، 25، 27، 26، ؟ الفروق تتكرر في دورة من ثلاث قيم ثابتة مختلفة غير صفرية، بالترتيب نفسه. ما العدد التالي؟",
      "choices": [
        "29",
        "30",
        "31",
        "32"
      ],
      "answer": 0,
      "why": "الفروق تتكرر بالترتيب 2، -1، 3؛ الدور الآن لإضافة 3، لذلك 26 + 3 = 29.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0477",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "1331، 512، 125، ؟ الحدود مكعبات أعداد صحيحة موجبة تتحرك بخطوة ثابتة غير صفرية. ما العدد التالي؟",
      "choices": [
        "8",
        "11",
        "27",
        "64"
      ],
      "answer": 0,
      "why": "الجذور التكعيبية الموجبة هي 11، 8، 5، وخطوتها -3؛ التالي 2، و2³ = 8.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0478",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "28، 39، 52، 67، ؟ الحدود مربعات أعداد صحيحة موجبة متتالية تصاعديا، أضيف إليها عدد صحيح ثابت غير صفري. ما العدد التالي؟",
      "choices": [
        "39",
        "52",
        "84",
        "124"
      ],
      "answer": 2,
      "why": "الحدود هي المربعات ابتداء من 5² مع إضافة 3؛ لذلك التالي 9² + 3 = 84.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0479",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "19، 23، 20، 21، 25، 22، 23، 27، 24، ؟ الفروق تتكرر في دورة من ثلاث قيم ثابتة مختلفة غير صفرية، بالترتيب نفسه. ما العدد التالي؟",
      "choices": [
        "23",
        "24",
        "25",
        "26"
      ],
      "answer": 2,
      "why": "الفروق تتكرر بالترتيب 4، -3، 1؛ الدور الآن لإضافة 1، لذلك 24 + 1 = 25.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0481",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "15، 12، 30، 36، 60، 108، ؟ المواضع الفردية متتالية هندسية، والمواضع الزوجية متتالية هندسية أخرى؛ والنسبة في كل منهما أكبر من 1. ما العدد التالي؟",
      "choices": [
        "120",
        "240",
        "480",
        "960"
      ],
      "answer": 0,
      "why": "نسبة المواضع الفردية 2، ونسبة الزوجية 3؛ المطلوب من المواضع الفردية، وبعد 60 يأتي 120 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0482",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "22، 27، 29، 27، 32، 34، 32، ؟ الفروق تتكرر في دورة من ثلاث قيم ثابتة مختلفة غير صفرية، بالترتيب نفسه. ما العدد التالي؟",
      "choices": [
        "36",
        "37",
        "38",
        "39"
      ],
      "answer": 1,
      "why": "الفروق تتكرر بالترتيب 5، 2، -2؛ الدور الآن لإضافة 5، لذلك 32 + 5 = 37.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0483",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "13، 17، 19، 23، ؟ الحدود أعداد أولية متتالية تصاعديا. ما العدد التالي؟",
      "choices": [
        "19",
        "29",
        "37",
        "41"
      ],
      "answer": 1,
      "why": "الأعداد المعروضة أولية متتالية؛ أول عدد أولي بعد 23 هو 29.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0484",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "216، 294، 384، 486، ؟ الحدود مربعات أعداد صحيحة موجبة متتالية تصاعديا، ضربت في عدد صحيح ثابت أكبر من 1. ما العدد التالي؟",
      "choices": [
        "294",
        "384",
        "594",
        "600"
      ],
      "answer": 3,
      "why": "كل حد مربع عدد متتال مضروبا في 6؛ التالي 6 × 10² = 600.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0485",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "5، 23، 7، 69، 9، 207، ؟ المواضع الفردية متتالية حسابية بفرق غير صفري، والمواضع الزوجية متتالية هندسية بنسبة أكبر من 1. ما العدد التالي؟",
      "choices": [
        "5",
        "7",
        "10",
        "11"
      ],
      "answer": 3,
      "why": "فرق المواضع الفردية 2، ونسبة الزوجية 3؛ المطلوب من المواضع الفردية، وبعد 9 يأتي 11 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0486",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "45، 36، 28، 21، ؟ الحدود أعداد مثلثية متتالية بخطوة ثابتة في ترتيبها؛ والعدد المثلثي هو مجموع الأعداد من 1 إلى عدد صحيح موجب. ما العدد التالي؟",
      "choices": [
        "15",
        "21",
        "28",
        "36"
      ],
      "answer": 0,
      "why": "ترتيب الأعداد المثلثية المعروضة هو 9، 8، 7، 6؛ التالي في الترتيب 5، وقيمته 5 × 6 ÷ 2 = 15.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0487",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "5، 16، 10، 48، 20، 144، 40، ؟ المواضع الفردية متتالية هندسية، والمواضع الزوجية متتالية هندسية أخرى؛ والنسبة في كل منهما أكبر من 1. ما العدد التالي؟",
      "choices": [
        "16",
        "48",
        "431",
        "432"
      ],
      "answer": 3,
      "why": "نسبة المواضع الفردية 2، ونسبة الزوجية 3؛ المطلوب من المواضع الزوجية، وبعد 144 يأتي 432 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0488",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "12، 17، 23، 24، 29، 35، 36، ؟ الفروق تتكرر في دورة من ثلاث قيم ثابتة مختلفة غير صفرية، بالترتيب نفسه. ما العدد التالي؟",
      "choices": [
        "37",
        "40",
        "41",
        "42"
      ],
      "answer": 2,
      "why": "الفروق تتكرر بالترتيب 5، 6، 1؛ الدور الآن لإضافة 5، لذلك 36 + 5 = 41.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0490",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "52، 44، 36، 28، ؟ الفروق بين الحدود المتجاورة ثابتة وسالبة. ما العدد التالي؟",
      "choices": [
        "20",
        "28",
        "36",
        "44"
      ],
      "answer": 0,
      "why": "الفرق الثابت هو -8؛ لذلك 28 − 8 = 20.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0491",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "3، 5، 6، 14، 25، 45، ؟ من الحد الرابع، كل حد يساوي مجموع الحدود الثلاثة السابقة مباشرة. ما العدد التالي؟",
      "choices": [
        "59",
        "84",
        "109",
        "129"
      ],
      "answer": 1,
      "why": "نجمع آخر ثلاثة حدود: 14 + 25 + 45 = 84.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0492",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "14، 18، 26، 42، 74، ؟ الفروق بين الحدود المتجاورة موجبة، ونسبة كل فرق إلى سابقه عدد صحيح ثابت أكبر من 1. ما العدد التالي؟",
      "choices": [
        "106",
        "138",
        "202",
        "234"
      ],
      "answer": 1,
      "why": "الفروق هي 4، 8، 16، 32، ونسبتها 2؛ الفرق التالي 64، فيكون 74 + 64 = 138.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0493",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "144، 48، 54، 18، 24، ؟ تتناوب عمليتا القسمة على عدد صحيح ثابت أكبر من 1 والجمع مع عدد صحيح ثابت غير صفري، بدءا بالقسمة. ما العدد التالي؟",
      "choices": [
        "2",
        "7",
        "8",
        "11"
      ],
      "answer": 2,
      "why": "تتناوب القسمة على 3 وإضافة 6؛ الدور الآن للقسمة: 24 ÷ 3 = 8.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0495",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "6، 10، 19، 35، ؟ الفروق بين الحدود المتجاورة مربعات أعداد صحيحة موجبة متتالية تصاعديا. ما العدد التالي؟",
      "choices": [
        "39",
        "44",
        "60",
        "84"
      ],
      "answer": 2,
      "why": "الفروق 4، 9، 16 هي مربعات 2، 3، 4؛ التالي 5² = 25، ثم 35 + 25 = 60.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0496",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "6، 14، 41، 105، ؟ الفروق بين الحدود المتجاورة مكعبات أعداد صحيحة موجبة متتالية تصاعديا. ما العدد التالي؟",
      "choices": [
        "113",
        "132",
        "225",
        "230"
      ],
      "answer": 3,
      "why": "الفروق 8، 27، 64 هي مكعبات 2، 3، 4؛ التالي 5³ = 125، ثم 105 + 125 = 230.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0497",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "210، 190، 171، 153، ؟ الحدود أعداد مثلثية متتالية بخطوة ثابتة في ترتيبها؛ والعدد المثلثي هو مجموع الأعداد من 1 إلى عدد صحيح موجب. ما العدد التالي؟",
      "choices": [
        "91",
        "105",
        "120",
        "136"
      ],
      "answer": 3,
      "why": "ترتيب الأعداد المثلثية المعروضة هو 20، 19، 18، 17؛ التالي في الترتيب 16، وقيمته 16 × 17 ÷ 2 = 136.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0498",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "36، 14، 49، 12، 64، 10، 81، ؟ المواضع الفردية مربعات أعداد صحيحة موجبة متتالية تصاعديا، والمواضع الزوجية متتالية حسابية بفرق غير صفري. ما العدد التالي؟",
      "choices": [
        "8",
        "9",
        "12",
        "14"
      ],
      "answer": 0,
      "why": "المواضع الفردية مربعات 6، 7، 8، 9، وفرق الزوجية -2؛ المطلوب من المواضع الزوجية، وبعد 10 يأتي 8 وفق قاعدتها.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0499",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "4، 8، 11، 9، 18، 21، 19، 38، ؟ تتكرر دورة: الضرب في عدد صحيح ثابت أكبر من 1، ثم إضافة عدد صحيح موجب ثابت، ثم طرح عدد صحيح موجب ثابت مختلف عنه. ما العدد التالي؟",
      "choices": [
        "38",
        "40",
        "41",
        "42"
      ],
      "answer": 2,
      "why": "الدورة هي ×2، ثم +3، ثم −2؛ العملية التالية إضافة 3، وناتجها 41.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 2,
      "status": "approved",
      "flags": []
    },
    {
      "id": "fmt-sequence-0500",
      "cat": "fmt-sequence",
      "type": "mcq",
      "fmt": "sequence",
      "q": "9، 27، 30، 90، 93، ؟ تتناوب عمليتا الضرب في عدد صحيح ثابت أكبر من 1 والجمع مع عدد صحيح ثابت غير صفري، بدءا بالضرب. ما العدد التالي؟",
      "choices": [
        "93",
        "96",
        "276",
        "279"
      ],
      "answer": 3,
      "why": "تتناوب عمليتا الضرب في 3 وإضافة 3؛ الدور الآن للضرب، لذلك 93 × 3 = 279.",
      "src": [
        "gen-seq.js — local",
        "verify-seq.js — local"
      ],
      "level": 1,
      "status": "approved",
      "flags": []
    }
  ]
});
