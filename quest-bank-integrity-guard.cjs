/* quest-bank-integrity-guard.cjs -- THE KUNUZ BANK, THE SEALED FILES, AND THE SERVICE WORKER.
 *
 * WHY THIS GATE EXISTS
 *   It was born as the structural gate of the old treasure journey's bank,
 *   quest-data/trivia-golden.json (B1..B9: count, identity, categories, schema,
 *   duplicates, answers, option-free stems, sources, the 394 protected questions).
 *   ITEM 10 (2026-09-17) REPLACED THAT JOURNEY: quest.html is now the Kunuz hub, the
 *   two modes live in quest-ghaws.html and quest-harb.html, and both load ONE shared
 *   bank, quest-data/kunuz-bank-3147.js. The old bank and every golden that described
 *   it were removed (copies in _superseded/), so B1..B9 left with them -- a check of a
 *   file that no longer ships would be a check of nothing. The gate itself stays,
 *   because B10..B17 seal the scripture files and the service worker, and nothing else
 *   in the repository does.
 *
 * OFFLINE. No network. Reads only.
 *
 * DISCIPLINE: this file contains ZERO literal Arabic -- same law as quran-guard.cjs and
 * esc.cjs. A guard that prints raw Arabic to a Windows console LIES about what it found.
 *
 * WHAT IT PROVES
 *   K1 bank shape   -- the shared bank evaluates to DATA with exactly 11036 rows (10423 live, 217 legacy blank holds and
 *                      396 quality holds retaining their complete original content; all named and hash-pinned below)
 *                      kept in place with their ids, and the old 10935 ids an unchanged prefix of today's) in
 *                      53 categories; every question has the nine-field shape, a category
 *                      in range, a non-empty stem, 3..4 distinct options, a key in range
 *                      and a unique id; no category is empty.
 *   K6 bank rules   -- every question after the accepted 3145 offers exactly four options, no question
 *                      is true/false, and the entity rule holds over the whole bank (named exceptions only).
 *   K2 one copy     -- quest-data/ holds one bank, its levels map and declared visual sidecars (2026-10-19), and no page in
 *                      the repository root embeds a bank of its own.
 *   K3 the modes    -- quest-ghaws.html, quest-harb.html, quest-test.html and quest-board.html each load the shared bank
 *                      exactly once, and each carries a way back to /quest.html and a
 *                      way home to /.
 *   K4 the hub      -- quest.html carries the home link to /, a door to each mode, and
 *                      does NOT load the bank (the hub must stay light).
 *   K5 the entry    -- app.js still enters the treasure at /quest.html, so the app needed
 *                      no change for item 10.
 *   B10 sealed      -- sha256 of the shared bank, the three scripture / adhkar / layout
 *                      files, the manifest and the service worker. Unconditional: no git,
 *                      no branch, no skip.
 *   B11 sw policy   -- sw.js is EXECUTED in a vm with self/caches/fetch stubbed, and
 *                      a synthetic FetchEvent is dispatched at it. Every same-origin
 *                      data file must be served from the cache AND revalidated in the
 *                      background; the read after a change must return the new bytes;
 *                      a failed fetch must leave the stored copy intact and raise
 *                      nothing at the page. B10 proves sw.js has not MOVED; B11 proves
 *                      it still WORKS, which is the half item 80 was lost in.
 *   B12 sw quota    -- the same worker, executed again under FOUR measured storage
 *                      states: a wide quota, a quota too narrow to start, a disk that
 *                      fills mid-write, and a browser with no navigator.storage at all.
 *                      Asserted on what the worker DOES -- what it wrote, what it
 *                      deleted, what it recorded -- never on its text. Item 91-A.
 *                      It also re-derives CORE_BYTES from the CORE list sw.js itself
 *                      declares and refuses ANY deviation, in either direction, so the
 *                      quota pre-check cannot go on measuring against a number the files
 *                      outgrew or shrank away from. Item 112.
 *   B13 sw report   -- the same worker again, asked what it SENT at the end of install:
 *                      a clean install, one entry down, several entries down, and NOBODY
 *                      LISTENING -- plus a browser with no clients.matchAll, a client that
 *                      throws, and the quota skip. Item 93-b.
 *   B17 new mushaf  -- the reader in mushaf-lab/ offline: activate keeps its downloads
 *                      store, a page and a geometry file stored only there are served with
 *                      no network, IDLE warms every same-origin file the reader requests
 *                      (parsed from its files), the store name is one string on both
 *                      sides, and the reader's own text and recitation paths run against a
 *                      stored copy. Item 4 of the register (offline).
 *
 * USAGE
 *   node quest-bank-integrity-guard.cjs --compare quest-data/kunuz-bank-3147.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');

// ITEM 10. The one bank both Kunuz modes load, and the figures it was accepted at.
const BANK = 'quest-data/kunuz-bank-3147.js';
const BANK_TAG = '<script src="/' + BANK + '"></script>';
const BANK_QUESTIONS = 11036;
// KUNUZ-LEVELS-POETRY (2026-10-19, B): the owner had the poets' private-life questions pulled. They are RETIRED IN PLACE, not
// deleted: the row keeps its id (so the stamp of the old 10935 ids stays a prefix of today's and every player's no-repeat
// record is carried, not dropped), its field 2 is 0 and its content is blanked; the pages never draw or count it (kzLive).
// The new verse questions were appended AFTER the old rows. Legacy blank holds are named in RETIRED; the quality order's
// additional holds retain their original content and are individually hash-pinned in QUALITY_HELD. The nine owner-removed battle rows are held there too. No other hold is allowed.
const QUALITY_HELD = {"poetry-fusha-0191":"dfac5d4d0d54d31d16b46325069476bedb9904f059be6dfe38c604adf90885bb","poetry-fusha-0192":"b6313aa2c503589d080880cfbc5cd5e2fbd23eeabe7560f06b77309c0db2b6de","poetry-nabati-0027":"c7e9c741443f8a62d94d2db0e01187ca3ec19e2849076ee61fdcf98625838958","poetry-nabati-0028":"c0f716d1d7be6c142fff81409f36d41cc6205d67a5ca1a31208027a000f2ea43","poetry-nabati-0030":"0620b14c9d7cc05deac070e2f43ba04417e68fa995e7d56d7655e72acfa3a1f8","poetry-nabati-0032":"d82a9049723ffb98245f2e3504b2604c8dc48e9cb7820ba0656ffe87418034fb","poetry-nabati-0036":"3edb22f26655d5df01683db77efd4606290dc7d5d035acdfdcc34f04a500d7bd","poetry-nabati-0046":"223a0251d9b0c1e584372f7de9132fcb329670477dcab991213b4b91516339c2","poetry-nabati-0053":"29167c5939a713eb9f701a2e1cb051774a62acd70f18de4419968ca68c053d0c","poetry-nabati-0059":"e2b6930f6e713cc86d083abc3397facad61603faff769b442f21a29f459c47da","poetry-nabati-0063":"ed4b4ce906336868b695c5bc83488ab65ae4e4615ade85eea2428f72819f9295","poetry-nabati-0065":"2ae501c6836be867447570240d9426580d08c4f369f390b658540f3be2c613ab","poetry-nabati-0067":"e722b912c9f5f10f439975a12c036995e1eb39e715ee9d50819c596f36fdbf7a","poetry-nabati-0068":"70b0ba9fcdbf5dcd57bfc2c04a3d6e150d341bb80dc84a4c17871ab1349b1ce0","poetry-nabati-0069":"3dcadf1b0d4a41d63a4468418aa847c5f901a3b78336839c6faf29d1a8034ce1","poetry-nabati-0101":"3bb6b6fd4e890a1520d6c89e566db144dd4f2cdd616a18e706b41bd647a151b1","poetry-nabati-0106":"4cb99c88edc45c333b7298c337c8bb9818e322d63872a687f5cb5ebf8e56d690","poetry-nabati-0107":"2d46aad6ba42833709eed198718d7a2a9aa0a4f4dc981ce19a78f0fba9798593","poetry-nabati-0110":"5e2329c337e071a5f8e9a667451d7471101155282c987462cb8eaa6feb258909","poetry-nabati-0127":"5c718a49fbe89fc058c6e2ea5afdda9f7b83c1d67c0a8f877eddfdb992d99f5a","poetry-nabati-0128":"7a553314fe32a60da7e411ca74a19cb84181a3bfe92ea4106754a0406a91c15f","poetry-nabati-0138":"0354f19e5819ad759552ce4758500765554648a0d2787aaaadbf1d8cb1f70425","poetry-nabati-0139":"ba09c56f9d893d80bf976e09b2b0e22bff203812c8a92e0fb45f0a21e42db51f","poetry-nabati-0140":"4c90f99fe78dcb42e197428e20ba1d6acd9bd8fceff9f469789f6e5edafb9d0b","poetry-nabati-0149":"b0973e352eb347c84c5fac941a56ec3dd1ecc5f84af29554b23d8dd9a612e761","poetry-nabati-0158":"b6307fb8d73032f2f83290894324be27d35dd05ae1d622343a8280acf957ffd8","poetry-nabati-0161":"eca3af1ee008f29cd44afa1c2adc13818002773e7d0e0e2e7063d2300667d32a","poetry-nabati-0168":"8d774c15a8ccdbee51f63d3e01d2c6a30827895d1f4897935132035376edeee3","poetry-nabati-0184":"08a29db4c0cfbe9b921902c0af1bddf3b65d4cd51bb5d034dad6e8de83da976a","poetry-nabati-0200":"d9da626fea995e36c11fc8f2e9c42e9cf0e7ad367970ac8af8935605df73c930","poetry-nabati-0205":"20a6eefcdce1104643044eaccf0dec7212e0a81664ca275bff934c6781c9aaa1","poetry-nabati-0207":"63d2f9b9ae7d2fdd03c8cbcdf74f414ddca5af76f1d3dc4c5a7f48b116c6bfff","poetry-nabati-0209":"a194844b0cc65c26b22f56e409ac9d65f740067fe77c9bb326ca90cebf3c4be8","poetry-nabati-0211":"af004f2e96bfdc1bbbfb1beb32c24b47e92c239eaa22616910477164ad2ace14","poetry-nabati-0215":"a316616ba70875c727189868fddb9eb06ba7b65558945afd0a79e5eea774b68b","poetry-nabati-0216":"eb7d1b5bbca7ec3c06b0a49f024c16a231d69170f430ab4b3aa3c9802c561d39","poetry-nabati-0218":"cf9bc70843f5f2c3c168bb01383597b6476565ab82c29a6e663bf09146dee9ed","poetry-nabati-0224":"b41fe5110d550afce784cf651564f43ab2732bfc9ea9e9edb97eed5e0c9a0655","poetry-nabati-0229":"2ad9bfab32967caa82ecb88e6d936f2f24b803fac5c95fbae3974f4ddeb264d4","poetry-nabati-0230":"981fa9ce3ff142d35d4b86d73b15d156d0d8d12365bf34c225f5f5b5cbb2eb79","poetry-nabati-0236":"98bb1d55170f063dc59e2bac6b0337e3f24ab26d36b36be42d3abeb176c4bb80","poetry-nabati-0237":"e283d7f5ff5cfe89990f67753a43c50d237162d2fa1ad6c0ea9ad085dc13cb6b","poetry-nabati-0238":"df204f22034898cdcf0bef2c03d3e0274b7cb8e760b8451e419613574921f7d8","poetry-nabati-0241":"0ea0b14c518ca50abf63964707c7d14595c8f341847caa166449cf219df2a838","poetry-nabati-0243":"179fb04131ad6e7417b5c74bde1b34f87ff3050118c16ac26fed95874292846b","poetry-nabati-0244":"880e8d2a5a90ee2c8e536b4a19c98b529b16eef90748fcfae974d1b2f1efb6d4","poetry-nabati-0250":"2bc7142c746ea3a1632a77d463a1e140da8021cb3eace02e400c00975d361ce8","poetry-nabati-0256":"d88cd1b21b1badb762a16b6e148c5e71769142113699b390d96b650d9a963cff","poetry-nabati-0262":"78698d3fa95d8354e56ead5c76c300fa54b7d868fb3748bcd441ea5339a5954a","poetry-nabati-0265":"769f6f03a16d8f9e40430c19840a7278146332373750953bdb1c9a5ca2df7101","poetry-nabati-0270":"c55ed72a0f7901aac72b22a88f3ffac9b2febe7e6c8a15d637d670cfe565dffa","poetry-nabati-0278":"202be7688611aa46bb6109961aad716be0a0e447e458ab7d230599399ae1e9fb","poetry-nabati-0282":"da734e67b909db9ac7b6e835df62e94fbcce4d48fddd9d802761fd62264d9f34","poetry-nabati-0288":"1dae57c03723c53464769c28a0d2feffdbdac3b915294a24b8f7216dcc5e1fd1","poetry-nabati-0290":"4b19376db78a3b9f93360edbc352abaaf23e1cff858e3f93ec0c53ed8c1c0aa2","poetry-nabati-0295":"14ba572959f22729bc88b7111ed969e7ed75ee8d3d851f5fabba0e35a3918423","poetry-nabati-0296":"17504bbd1b92cee25c5d1ef19e4afd6ca171de521805f93c0c4c30922ac4590a","poetry-nabati-0298":"4bc8a624e1b38700150795b86951dec3f85fd85e407060dc2eee2d94b4cb9706","poetry-nabati-0299":"ad666b704e217f13131f7942d6cccb44659e48158508c246359c0e3633c93312","poetry-nabati-0300":"d1ee14fe591a769baa6b62ca7397fff0783f92b7c536febaf591d2c35ce6fbe5","poetry-nabati-0301":"85fd5b558ce37d8be97ad6ba2410e246eea3e8e98ddbdaca9fd0a51c27473de5","poetry-nabati-0302":"d555c58bccb72097c251e5856d7a890fdf4c90b78f9884d12e9d2a5176855f62","poetry-nabati-0304":"32692fa3ede2ef457a981ab971fef0cf8fa0d2a9bc6a0a556cfa74c9f42e58e3","poetry-nabati-0306":"30733b1b6d625389eeb1cbbf6d362499757c300968c7e0e74355ff64f49d139e","poetry-nabati-0308":"282335556e86c0afdb8ec9f048136101762b5feb0cb273f04bbbbd8b25e82ef1","poetry-nabati-0320":"603c82b93314fb494ba6ef0dc39ab1ec688120b8b57b4060e17fa74a89d78507","poetry-nabati-0321":"ceb796cf9ab0694d666ecdab2ad7f719631bfd01dd8157b7b8aa7ec59d7819f4","poetry-nabati-0323":"e88dd5ef8f1627360aa3cf95e11fdd4fe1069f7fd85939373e1ecabc0a03381a","poetry-nabati-0324":"89896c7a778e6aa93abe2801acc6db0ae0adcb8472b0a0bd1338f9e8d989f35a","poetry-nabati-0325":"dd318c8263cfb3ce56b1e6bb10d6ddbf8ea243920806b599abe75ce9c7ce6788","poetry-nabati-0327":"2c43347ea53bc27a56abaab6f47aa6366d49d31bac98d902341c54cdca11c588","poetry-nabati-0329":"d00712a63cf00c9e585c08863a2974bc61edce2ad8a6ed61b7f93e00930e6c35","poetry-nabati-0331":"22eb7db2e6095584a15690101c31297642e8124dca2df84d06aba804b5032c51","poetry-nabati-0333":"21e6ec3dd836576f2ae2d221271937fde1dac367e39a9bf650ffd48e65a4f26c","poetry-nabati-0335":"fd28effea7a38a8bdbc840b39392d099278a5986ca71aca432f1a9943d5c4298","poetry-nabati-0337":"e2ff61adee59e2a28c37b96f91a860d697e1f86416e19ccc0ec9bc591a1ca6a6","poetry-nabati-0339":"8a6e490acbcd66b9ef85a0ee54db4b6df6747ab7f6621fd89e72f7e7a4139783","poetry-nabati-0343":"83c1d1c2bd8fce6eab3380428ee5f5bec9eaed303fcc4b31b08aafe048fb1e13","poetry-nabati-0345":"cdd3616520f9bd3c1af22b2cc9edd99911b59723f315305edb85f36a26bebf7f","a1-geography-0013":"4a67a9b4d5239389106f45788b040fd808a9923506ed202079a7b01df5686b04","land-0002":"3374556bc4273f10a2be5e6a8e576b577eefa27564790addb80cee3a25ffeaff","land-0003":"f29cb01da124f4e189d9e91696c50bb245a069c4703fc04e098fa83d8c0d4741","whist-0015":"7350b3426786e0b23edd54bd7db4784cd08e5212429917e03e2289ffeed741bc","whist-0021":"caac959068c1517de8b97b8294d1838cc13c3b3a77e2777a577d3ead0cfd013e","whist-0028":"8bfcce619653629b69df89f1047a703705d628b00dab021226af936c9fffa7d6","whist-0018":"aad79a1453a213854b4b520eb16e8331d653afc9a64cd699fc8328cdc4a8819f","chatgpt3-world-history-001":"8681e66ee47229663bcac0cead625cc97ce2cc3e6c6efa5049b70fb3c8703ddc","chatgpt4-world-history-001":"ee9e04a73b93cc90dcfe18aaa1ada42a209525da550adc15b1d5cb42f9a70ad8","chatgpt4-world-history-004":"0d5f1611a840814c30e86618584a74f089e6091013602094afdfbe40efee6753","chatgpt4-world-history-015":"6d77a8831049cb984e48529815b5ed3d7073089cb569a4604944be5d8b4dffb6","chatgpt4-world-history-016":"b120490e8d8dae62fccde57baf10549d2bcd979bc91332dfa6b72ba45fd2b8c1","whist-0001":"a9d550b2fcd797ae1ba62f2e73c6efa657a483a406b000ab5ec25e50b3d314a0","whist-0004":"8e2cabd4afa48014ab92b0ce29cdb67b8fd4d895085f919509f5af3e064f3ade","whist-0006":"814dd8982f331501cb24efd1f3a67f29fa0edd9e432de677c898145de1e94196","whist-0010":"d5258a1727d9bac46fa26722d5f11d60ba0d87c786925ac96c244993238e61c8","whist-0025":"0a4260b1ca859e144850137ad34171572e14ae869c973565c31f48c327953a6d","a5-hadith-0377":"e6af38a5c6a2c53a56e6dbf8287cd756101b98dc34f8603fa5d82f32c64bc02e","a5-hadith-0387":"e94e8617cc233961a01c4905d1c7464434947bbc2ae0e9afa54bfc2b7defe8a7","a5-hadith-0422":"01b87b2437b607fa972523b717d1cfdeace217687b014049eb3bd2a8ef9c3c4f","ayyub-0003":"21c4acf1b79f284720a1148da503a5bac04a5533bb948809878f714e1a720b98","ayyub-0006":"d9e2dfc4112ea8839371425782c96ed1e2a06b19f4fb1f2c06e272b80cf00e2b","a3-arab-0043":"8b2362348326b36d22b7078b38b3d277bc1294d85651fd5a665e391129e8d6eb","a4-arab-0070":"0484c6ed902dc8f31db6a4f99ed5950938e03b48b962a9b15ba6f134d1672198","a4-arab-0083":"635e3d6179efb72286eaed355dd08da3081140b00137095a25875505aaab925f","chatgpt2-palestine-history-005":"9932b61d028c8bd6aac8d954e61bb41c7f860636fcdfd6d89d39a1e29a8716fd","a4-kuwait-history-0002":"6b2ac8e1755a654142f021ac3df72254c2fd0ded8f7715b6b4ba0b1b1b05b2a6","a4-kuwait-history-0009":"ca2e3d023b2afafb805b604f205f569b28d3616a602e94118d6dc3a81a4ad423","a4-kuwait-history-0024":"82b34cccbce9ac65e02f8298036d1e4875522c94753642b5e479c9b8ecbecf3e","a4-kuwait-history-0027":"2d17aa851c26d53f022c167db8616e743a508b90df492e4c30dd417f793e0214","a4-kuwait-history-0050":"250d5efd54aa4db954a6231f30af282a044addc5b49028ad07cbd8504398e06e","a4-kuwait-history-0069":"c984e756826c60a75eef0ad790fd0a235e76877419ea35f56866aefc8fc9f42c","a4-kuwait-history-0072":"9806295d2aeb505db54664915fc5eb0d57910d15dc1f6d5e0b6bc20907e558c9","a4-kuwait-history-0083":"62cb92e4895be64ec021d0d6782e3dcc540d54d62a877a091f8c81cc14c68830","a4-kuwait-history-0111":"183e73efda9f41ce63414b71e11490b96a8f98ad127316d580d784b28d00f491","a4-kuwait-history-0179":"5dd48766fe9d112e8b02ad9152e7054bd204b026df6f37d3147bc3c6e5c8d299","a4-kuwait-history-0219":"b5e1f11b9c8d122b24500a3d9f2e9e1e9aaaed9c75a188780dadc1fc5c75e413","a4-kuwait-history-0237":"39152203dba7eba7f615881beb961918ab689e34e5cd960e068aa6a3d519fc7c","a4-kuwait-history-0348":"685fce022c1d73e033dd2fa4d308c8333e867c2b19b9f55e28f46daed445ffa6","a4-kuwait-history-0351":"bd5635a9a354637686a7e5ff84b9e158ab19e34d063d4b0597a2fee30efee838","a4-kuwait-history-0369":"8e93553f326c219fc211a81c225cf9e1a067ed82da99c1dc0e8600650604d5e7","a4-kuwait-history-0394":"63c141b65f3258b6a6c72f05c6f13906253114f8c32bfd4fed19be01a3396c0e","a4-kuwait-history-0400":"cd3b342285bddf8f5b892e5332b860232eccb5dff08aaf5752834b38b1a4ae77","a4-kuwait-history-0403":"6d8aaac77b66946ca0654574c7c13b92267e5e4070ce21dde31e212db8c5f456","a4-kuwait-history-0427":"6629bd3ebdcb4b0f255bbf7d6e42950f62fbfdf84dd485536202795b31383363","a4-kuwait-history-0442":"9310bfd082e1818007427b2025894a4a601618d2df61289c5f64d4d03e56fd33","a4-kuwait-history-0032":"17eb4c39423514a852dedf1543c40c6003b6de47aa3f1fd08808a0623a714a9d","a4-kuwait-history-0035":"30314ea6df2aa14e5639c27b59fdda13fb07c1c5f8d4f14c48b466f66a28cb2f","a4-kuwait-history-0038":"a19003aded825cf20c80c016ad7e6aefe8cbbe6cad498768c6bc6259433269be","a4-kuwait-history-0041":"5908c605675a7c2cac26af4568e4d49811236ed5b932232fbe335f1379fecf55","a4-kuwait-history-0042":"7276911459d8faf405750e33409b2b13f5ed39a9687fd90330c689ae1ad13ed1","a4-kuwait-history-0044":"7c4a4d5ae6ca4971ff6559e15c8b34e7e7fa72152f2d5ee286225b1af7af76f1","a4-kuwait-history-0047":"d4132def70fb8196e1eef01f8c593f543aa690f872c70f47817267cc92dab640","a4-kuwait-history-0074":"cf1b6178b4057544e9da0491003c723982d689ce24cd559047f4440f3c7c43fb","a4-kuwait-history-0439":"98aa1bd088a7e84883a6fa0e2c870cdabdeefcb6ba1b76fd89b07a926cc8c8fa","a4-kuwait-history-0210":"a2f592926d75c8648c843eec3ff8f2cb25cbd8b6249cc9d3a3e969a1d742cda5","a4-kuwait-history-0360":"9b08af3bb04dd7259c1ff4c7a330bac092cd806955d152c6285bd2e9c7ed9c84","a4-kuwait-history-0096":"76144b91ca8d76e92fbccee34d5387d343ee6825a2c27438fa83295c650ee15a","a4-kuwait-history-0228":"be2409fda982f5e45a160901ba7eeb572698b59c7d5f2842f4c670a735ab2a64","a4-kuwait-history-0417":"b79ac9ddb33471e7e1a6f9280fb01a5ff271dbc7c85102b9b644214691087e14","a4-kuwait-history-0288":"e626911a9221675585a0cd13b3b258891b9cec7a31b43e59e1b10a971de8d7aa","a4-kuwait-history-0354":"c23e4c76f2e6de5221bda0c4316f9c6d47d109b896a940e7303d106a57536cca","gemini-ayyubid-002":"3d56b247b6def8f817a656e5c1fd68039a0d9250c1d88827cb003277423d6117","fitness-health-0298":"aabb5cac5ccdfcdc079a56ceed425306ecb0fa0e64111142f7bfb4073918e91d","proverbs-0036":"62a23592984b206dacf9bf4f6c27c1cfc555318fbe518371113aaf4d30b485ba","proverbs-0039":"f61703b101e05c686db45458000cf54f928271a6b099285fc96bf5024c643a4b","proverbs-0041":"5787da5320398aa130e38afd1e01a7bbc4ea0a5eb0b0f61b16f48cb85c0e28cd","proverbs-0043":"eed451c90c2306c8cc7c22821ad94e240cbc6a9be51566e77caea5e33f2c1cf5","proverbs-0044":"9d6190acf241d1464aa2fe299c0a4c7ad93dd560b96624152beedfa85c072ba8","proverbs-0045":"f024f6f39109366d7d95c633fe633072f7cf469b7bacc723298811cca59db1b0","proverbs-0046":"339edbd5bd2bf6a6a2a92b4d5318892139d1903f36f19784fea032375a752370","proverbs-0139":"3df30701b04371631ec9df1ee5c40420b43bb62cb04785d7cb0c06c7e3e1af16","kuwait-sea-heritage-0329":"e10d083cb43c5ca3a89f5b235ddc055a6db1c26fbc00b1f266e547c9c71b6204","marine-life-0270":"29254a3ba488994ec56cd0ec7977663732b3a0762363d3e1219938023a98d416","marine-life-0287":"caeadc69f5419469d6a998a6231bb64e596567766b1aba1757d4cfbc830b0c8d","astronomy-0270":"eeb84b120ec75d7c699cd085a4bcfb458f70b503df3cb9188f5584771ba4ae00","earth-weather-0059":"ca451d78e2421710c7a0d157dac4d8b7c5b15f47a4f6da66337e9aa63bf23b0a","earth-weather-0332":"8f7cf37887e5082b594da53f0f99b8f935a3129299da39b06143f97fcd920dfc","human-body-0196":"30d48a3f65de31b53e64d72f2602730e33be2fbe6f9e19c4d18a6e3257b32bd1","muslim-scientists-0009":"79aae76da17cf0cc21f6ca0f05ca58cd8c319c2c1fd01d9c305d494218373c3a","muslim-scientists-0019":"a63866c10ce3db5e48d9648ab963ecc33b6c05c48fb3c59fa6af321ca059f677","muslim-scientists-0037":"277a4c9890304bc8d8c7734ff7d94d45f7a928520430a17e0862e3f165df5c3e","muslim-scientists-0048":"252f50c647b0fd519433d3417e3897a76cfb2c5015426bc00f780357851ab564","muslim-scientists-0060":"baac17c8dd5499990a7a674b3b1713379fee62d6a84daf1366d842c9d3eebad7","muslim-scientists-0071":"ff7357d5e24e39ad8273043ab16dca3099d8f2bfe182c98d09b51c4c4e74e4be","muslim-scientists-0087":"f044f1cbcb3e3e8824e818e61192dbc1b86ba930a4e956a50ceea3118226dc70","muslim-scientists-0088":"870fafb2100d304cbe750505013df076f015050d369b764b8ef75d9655f783b8","muslim-scientists-0118":"a0d0abb380f17116367da61d6fa5919d333899010fdd5cf85fd773f838c4abe1","muslim-scientists-0121":"478f124acb144ffd62bf210d78a15ac13eca110130817e3d27dc1de39559e7b1","muslim-scientists-0130":"9e3c353616be4b7e835f23d5fb6cdf4c88a8fe66d2cff5c6639e297c969a92dd","muslim-scientists-0167":"266afcd674ebd8709c993f1ee31d5ee8f8274c61f8520beec7ef588af56fc195","muslim-scientists-0180":"5e025214f4bf203b8f75861dc3085dc7d58a18477a1896442e760607df3897cb","muslim-scientists-0201":"2ff3e69dd1c2465173a9ad6055b11c97fcaf474f8dc5778ec85513111bf7c645","muslim-scientists-0206":"8bb21c43ad27ec17128143b96d8be6383ee5e65cc6c9f5816a39b3fee73782e1","muslim-scientists-0213":"1ee8c278c183910ac3833f50e62f4d98c5dbe029491b13df15d44035556d8695","muslim-scientists-0219":"879274638c99611d78b43b12b5b490cded84e008452d840ab36eb0dc2bf2980b","muslim-scientists-0226":"742bc2ea96040c495de95faa7761c8fd932229d3da1c43beebd8d77b118423ec","muslim-scientists-0230":"0185bac1573b302c7f0066c1877000c7c0f44be3a795098a8f44b04082109f4a","muslim-scientists-0233":"d26bb73fef13ac1fcffa5d523646857345763a2257549d82705e28e81e0731ec","muslim-scientists-0264":"07d634b0158cb182cda31ff11878c9561ade7cbe357da41005d546af11a21958","muslim-scientists-0266":"0e351a31de793e24be680ac172fa206937efca5872ad5090441e113e180a0a40","muslim-scientists-0338":"aef5a5c6a019ca7cd6f30514555e2fcb83a535ef510c47efe97f1dcdbcf183c6","inventions-0049":"53abcd3c6c46501ce3eb3a89c4788eb752bb6d5fad0cabd8dbb0a6d68d04b221","inventions-0203":"a02a029adc8b4f80ded897769b5fb87d94db4a240057f2d6588190f3eb0dff69","inventions-0204":"d9fac6328d160de12bd28cbd52b2640969babc8c8e832de5fc0ac92ea08d20b9","inventions-0205":"5d3f34c737ecc7688e037a03f5d8655f4c3db182b99575e158b12f2e24b67fee","inventions-0207":"1719f189cba281bf72b5a38811b232ad829e9b2832d1d82c91aef70c8efdb6ca","inventions-0208":"37cf7dd9a3073061641cd2f22b04d293d04c5a0df6c2c8331e6fc72e3e655717","inventions-0209":"1cc8a7274372c6c1015a0fb2c64a72696976244b7da784819ba2bcfd94ffdefe","inventions-0210":"7c3659ec09ba1b188f1c6e1e75c9c26674f187831d3d49a2d07767e932185e18","inventions-0211":"c86c88016d69a4e99b2fbace41bc67bd61fc6f9a29a94c254f86d64c758eaeeb","inventions-0212":"dd91238434a7052d38e886779f6863940af120f9564f845cc86f1ea1e8231135","inventions-0213":"7ba12b8074af945aa5a14ad748a649fcd87514bcdcddc8caf9e7845ac3048b89","inventions-0214":"5247412951d6d5a9e193ab0c34af5d0ef4576c359998056e667f208827428982","inventions-0221":"53a056abc793d7a56bc44bf58edb64a109087f784c9486764b8c3fc5386c0ef3","inventions-0253":"3027e419a1d53d3f84beefbf13b1d808552b2259357c424b281de55a2860f35b","inventions-0254":"93aff2eab4e0b86d71499358ea2f0bdd989b2cf14683bf7a86f60523d99e50b4","inventions-0260":"b655f24f26a73ccb44c72d5008148465868bc93c5960d64529dcd945e9f38f1d","palm-plants-0003":"6dbaef574e87ee5c2e4716f8c543a3d5693470cf86abfac2c7617ab9670b14e9","palm-plants-0080":"4e5359c4aebc721ccf4b8f7032379ba36cee31bb83fcb3bc75263d330a8c8265","palm-plants-0105":"c8b99bcd9b21c5a472a361e5a43331cf1f08a10bbb69c6e023abab7da3e41b6a","palm-plants-0168":"efd833c65118b90c1815c5c47de2138df90346d4ca7c443ea0098e9671b69807","palm-plants-0190":"e733884c6a48a1c96bd238f00c5b8c2af8202a6d343f15ceaa5b6c8ed979b501","palm-plants-0212":"e7f38c750da80a8929820246638f9da6af3e0813dfbb4999021a23fc7855e98a","palm-plants-0236":"3ee653d1b63383d882a37ce0adb0c7c60a2ea6797031528e3cc9cb4c5f5b8866","palm-plants-0256":"9e07d8b2cec8b88889cce3e78522a26b072203f59a1b0e3eed9b70946a92f27e","horses-camels-falcons-0187":"b56704b660e9ec6ac90156869a0452b0df9db6354929a4669f77878bd4bd1e56","horses-camels-falcons-0220":"163dba5e7b23e79eca4839fc1f4f69823db5db9e38189cfc4694485531fcf6da","horses-camels-falcons-0280":"10f5f77671c8d04de247837c41d91239ceaa9edbd428eb60ab9c5348de3f6cab","horses-camels-falcons-0289":"b093e22aebdfb9ee9a0dd0fa8ee9b8d78a78759572f4137138c90c62f8103872","horses-camels-falcons-0294":"31fe6f89d90b5be2aad9febfad7df1e86557649cd9f93c233da55f191d02e160","money-economy-0117":"146c3e4c98b3cf7f84e0e8a12f62dcb42c4c8adbf52762f6916c455087209874","riddles-logic-0088":"560031eb6a2e409b6e86b9a6e2253e887312391ebd98354a8162ec395a8f3acd","riddles-logic-0090":"0d04f876b104774bc284b9b0b61ed653b6981def6ca6e53fb346f7b59e9c4a17","riddles-logic-0091":"4a08f46835d417328ce4cd724c886d0604af24cae9a78e758101b7176e0c3d73","riddles-logic-0162":"092047c9811f35401b0d781eb7abeaafe2045767c7480e553b8d408ae6af4c02","riddles-logic-0165":"0a5606c44d052dea8fbab58feb1833d5d78984253117299c3dbcfcfeba8519b6","riddles-logic-0187":"be396f49d1105c6005029e36b0507e865ac37cd229d52a4139740f44371a32d2","riddles-logic-0290":"33b345e3a5dad88716e8d968869895bdd5fb567e449a3f9894b0a66c7cfc8d40","riddles-logic-0291":"9a1f86120abc0f25e0a09681dc4727511b6476a853cd882d8687d94456f2075a","tech-computing-0032":"95443221439705f2fea97b8925bf7ba15b7799edd5d089ab7293dee4b7763f5d","tech-computing-0191":"be3f2ad826db007b75b599760512babe62f7400ac9f759239eecfe920b318d98","tech-computing-0206":"cac0aa932f1d5a7b7e44313e76c9227bda80d4c48201d30b9d65c4fb7f83d75a","islamic-architecture-0022":"60ea6a1536adcbeffe3c9399b8d89ac5d244b71a737a5e770301634c682cc2b0","islamic-architecture-0065":"51cd0b92a6da142ac3c28e335c6ef10efc2bdde58443afe04e6ef72b93259eb8","islamic-architecture-0302":"b38a6b964f3244ddc89b239fb57c2feb25389035ca3d4a78fe30268a18bc20fb","tajweed-0016":"ceeef544ee890584ee5c12ef65b89babc522d9da5a6ab25c3c69b9f0e0833858","tajweed-0212":"6422eccf33898e0059adaf8a12887fc1027822d7269cfcaddd3083aa4ecec2fc","tajweed-0221":"46057f0259c05e8dc109302aff59508dc0d51475f8c669bbdbd10c84e13350f4","tajweed-0222":"df87079fdb42d61d59fcaf880c0430f082fe363d2c09a769178e9ad0c9cbade6","tajweed-0223":"a5aecf3d98d2efcf0b9adcc423903aed72942f6f892bebad0d01551c7fe2e248","tajweed-0224":"0fa83f521528a371da16a9e471bc556185c3429aa3967282136d59bb0803da03","tajweed-0230":"a7e7fca5a6db4a5df235eb83e34e84e577f62e7d543c8093c0341c3619f849dc","asmaa-husna-0283":"887dfce651e1ce722386a0eb5c4cfef3dd7a38f7daf2bd2b6a68ad9b5c120386","poetry-fusha-0220":"f20021c39dfddd36f21190f57158df3bc77f6065ccf9ef328afcae7aad427c1e","poetry-nabati-0132":"9c9ee0613f5ed9a810a71abe2de58c2b75518df217100a69474ca373f488947c","poetry-nabati-0190":"a074fd8c3d406cf25fbe8debe55c2544b9922eae598068f02a4cea0fc6d5448c","poetry-nabati-0291":"dbc032d896422a1190c823cf8fdb798613ff794e96136ef3b780ed335c7469f5","poetry-nabati-0376":"ec5f55dbd8a0dca68d2c2526f7e31688ce9ed4ba09985396e43b7c8e24f04583","poetry-nabati-0383":"f6af3a02342dddb55eadc0f97a04cb9b19b9ca737e427d2c0550fdc4b77a6576","seerah-0050":"37f4e020c29c08aff3ce15120ff8279a34390d2a7ae2d175dd37828342519a72","gemini-prophets-005":"1bbfa52d4f123bec0ac781b0608f487c365dc24f38750484df3f21a36d75ede9","chatgpt4-geography-005":"ffaa9ea267ca852c239b08307fd050c1358f916cc8b76f82cd3c6406d88a8ad4","a5-hadith-0007":"319fe1627fb569863edd4050820dbcf2f248758d94792d3cee3aeb3fd2d05c0b","quran-0014":"6b85032a6f49f35055dc1df767c9bfe09243c6c67bf7d29166fbf7ff25b04645","gemini-juz-amma-b3-014":"7c5f5042e83fb47ad9d0e14701326019491c51fd636282b07d89cc5071115fb5","gemini-manners-b4-001":"1230bcbd78ebc150cdc5290b811c40628059fc363f2cad5f997985aee52afe68","a4-kuwait-history-0227":"baea68d2879d8b187a321e4bf437344482e7f340c578777c092d8eeb632cc99f","abbas-0019":"590d60edc3aa9c4f913a4260f07d4a6769ab76502bc994648da94cc637f7a3e7","marine-life-0007":"6616d00148f905f57e881582095e906489f9afb1a8c851f1976f6f756c1128fe","muslim-scientists-0234":"247dfe66290cfeccc58e6376c1fa2273e1bbfa27ac35c772ee85bd3ccf95f5b1","palm-plants-0173":"f35e6ad83b820023862627650c43d9d541bc64849d917ff066e35fa444a09667","horses-camels-falcons-0053":"7f3f626a513f85ae8315e3476ed73e7ab5b0022f7ce23f04c7d8fc76ea281525","horses-camels-falcons-0054":"3c4cd8754e91de8643920c926a85a58f7c55fa6a05c954672df05eacc3cf21e2","horses-camels-falcons-0056":"9eb107fb029383ccb87f70b539e8c6a17ab3903eaf3f93adcfcc2e1e76922bd0","riddles-logic-0248":"37eeb9aada58443b3289009d1fc976d4d3b54c6d3085ec603187cd0696db2b6a","riddles-logic-0249":"7033e550650b8b340b6dd2b9a8308a650e839be75ee881777e5cd4cc5fd2bc1c","riddles-logic-0255":"c344e8f1794731b3a96f36f95457adde268d11cadd82eb833ac3a1abf85ed678","riddles-logic-0259":"e536b22f784fe58b511fb23264590d232e42f8b6129851e938c68b9c277efd70","riddles-logic-0260":"a2be34df24018efce6e82d70087ffb98d4c31305c00e5c3bb3d763315110c567","mothers-ahlulbayt-0182":"55ddaf64676743117c31bfdfef2858ce28717b59095fddcc36344af0c43c59bf","easy-fiqh-0237":"238c6919212a55d84a8209e54d34863b5e5e53ee7edb3c9cca2a36957d8db710","easy-fiqh-0344":"972bf684b9965f7fedd9ef178fecc9f72299cba305f92efc1d124533a9b8bcbf","gemini2-juz-tabarak-011":"3b9edadc239a88121cf7a5f6d1fc5202ba0d282c591648cd491ed41823c6ebab","gemini2-juz-tabarak-018":"768e318f243d5546d43793ef859c8c2a63222429c33f9b13a2fa28cabf10304e","gemini2-juz-tabarak-020":"cda2540b410e4ae453d2644ea77564f4b00c578d0fd63b396f59e4f1b23153ee","tabarak-0024":"00eb7126d608273eae61ae1bb620b021d27d2aed28a0cac0aad58c2e476162f1","gemini-prayer-b3-016":"27195a7fe2df51ce76c2c80c62114cd28ebcdca02e5f01493855134096cf8721","gemini-prayer-b4-005":"fbc48e824f410741f80bb0516955f67518f3eb4a8148d9b82ae4520866c1f198","salah-0014":"6dedee2f1b053b03b79d88ecb8a20cafc66505bcc09e067a439f606ac012291e","gemini-quran-b3-011":"80031696d1685a2429bd4cb22fdb1cffa7f395e68033f60f7237bfcdaada97c7","gemini-quran-b3-005":"d1806766f99f078b9420a6cda88bfe5aa837d83c493a93d8392eec8ebcb03dca","gemini-quran-b4-002":"e6e4bc16ca49b3e0c2a207940f2cd71233498d42a0a60943a980a2807fa3a376","gemini2-quran-006":"dc70d7e2d63bce89dff12c070c14b5b4340e46e1355d8a36e39e55765ad776d1","gemini2-quran-017":"e4fa0d326212dc76e9f6218f47b73afb7d0b5a096190485675088bbbfc84fea4","gemini2-quran-020":"403c16dd60b4e9533f69909f83a1e85d52e2ca6031e9b0cedebf1a619140d485","quran-0001":"a0595fa681e758b9db1f071898b895cf38b379a5b237a30fc2717d480c0345ab","quran-0006":"6e1a2c708e83ad9f7130a398a0f3d9248fefe02b58076d3f4884f8c595eae418","quran-0010":"94ee452c23ec36cb6fee33aa75656e66148d68a10c3c7cae6d603d429f96befe","quran-0016":"b28874d64eb4e414ff2e9b03057dd578fe97470ecef30f260f5892279558ecdf","quran-0018":"ff0d5c82e8d527d8dcc07d57187639f2ded54f5b322088a3c509c6ef4bbb87ba","amma-0007":"c4e0bf101e978a9b7702981dc6eb72e7690cee213e25e6cf9b82c2756a973b93","amma-0028":"1b48491942d1507db22481db8df3eff8f4a215ebfdf5a3f097b80a791f80c0bf","gemini-juz-amma-b2-002":"3e4cabab6398716dbf38fe1f31d227b6e984ee04d32f188a60a15b256eeec72c","gemini-juz-amma-b2-006":"332bc0fb8af792def0a8c180d90eb2fc6bf45a4af9c1ebfd7d3e055e2361179f","gemini-juz-amma-b2-012":"08d27d196541530a13ed698f2d33558e680c3d642d25cefbf0134fb0b66036a4","gemini2-juz-amma-001":"c56984bc5b46a90d22508563c3806d8914da1a14199b0dde0bdcad8f11e3c6f0","gemini-juz-tabarak-b2-020":"ae19c3427c4e586cbad982fd577df1f3cfa3396b25018f32825f77a94e66c46b","gemini-juz-tabarak-b2-005":"9000883f017e89047bbedfbc531ddece22d9f739444616b5665ef44cdd02e079","gemini-juz-tabarak-b2-006":"1db6bb734d50f58a422ff5998c51eb328da6b4e72b5a8cd78e67449980db248c","gemini-juz-tabarak-b2-011":"5f82ff824944a78cdf21660cd677e96cd7ee7e87d091db7930f5f063edba0bb8","gemini-juz-tabarak-b3-002":"e3b9766ba6dd7729703873cd110fe80a237760a383c69c1f997d2cdbdc2a12ec","gemini-juz-tabarak-b3-014":"f4d07de65b43d3916470d9a253299646b41195ff8b36af0c2d4370e8a7abe353","gemini-juz-tabarak-b3-018":"4259a2dfd8d667f56e3d3e39a34d16eddd0feea196c5c79b012a71eed2d644af","azkar-0023":"67444267f9e449f14debabd2168f89d1728688f0f84fb85163dd54bb3b1f6c7c","azkar-0029":"32afb1f6ca853928402ec1c698c12e9bbcb48972a9a75516dc5b8328188c908f","gemini2-prophets-019":"a721399a253258a3b8fb491764acfe8c130d4f5cc431162602a29ddb19156e7b","gemini-seerah-b3-011":"b387a978e87358ada97ff26de41c47d4d031569d32d8d051a4876a6cad017e88","gemini2-seerah-014":"03e7a7b2b9bcd985e81d1533724e5da22e21711aafa28c0e71dbd1aa5957d2b6","gemini-manners-001":"2a7049d1ed534a3cbff580c6cca7c3c1f537e75fcd5e29eb953508e8f5d783d9","ihist-0009":"3304f08834ad8286abe02239cf9e8cf1cde6c010b348b01ab094aaa9e0566b3d","water-0001":"22c8ea34b38ba862ac18ef402aba553f100d765e4c1d9ce8ae13e56da0a9fc6e","phys-0011":"2618987aca45358928b302a8f0a83abe2a5e8c9cee9e2bcbc69b787817dcb769","a5-hadith-0059":"33d3949fe46d8ffe1713995259ebb9b6b609c1413bf52b9611a8cf9e26f932bc","a5-hadith-0113":"53123d63abd30c4e168da4fa60eeff1d8354312d912006c7ee7388519da9d208","a5-hadith-0123":"45efcf67f17c6da91359bd1820097a4a875c2a9b6ef04f4eef15a96943f64288","a5-hadith-0130":"860712eed0c234f4eac9c8be6f7a80befadcb86baa75de79fccfee346930daaa","a5-hadith-0403":"7eff31af79f4d062064d603e1e64e9d27765a97557a9edf38ac590378604092b","a5-hadith-0309":"78e0158aba6d6421ffad27c9fd8b7a5e79bed843b6a8675f9ece1c0755167038","rashid-0020":"4785c68cc6e31a6fddf7e7ec14981fffe7d0d059ad27d19bbcd8c545ca421b78","gemini-rashidun-b3-019":"e1755182b9c9b72f69867adbf455e2d2a50d542d2c99ef888d86401ccfdf0a8f","gemini-rashidun-b3-002":"2f39aaeb9d93371b9d56c6142e017071ea1ce04684365fea82d520565ed217b9","gemini-umayyad-004":"73788b03e431e9d45a68b961ae526085117af2d2dd23754893a4e3bb48cc3396","gemini-abbasid-b3-016":"8b4c4154b2a93c32ad5dd254c52b8b73f90b387401d1fb7eabfd726d4fabdd3a","gemini-ayyubid-b2-012":"51b85edd2de27e5bd6f52cea3cd2421332810fb7b2b9732f9576f6c6cb638bcc","gemini2-mamluk-004":"3fa85210f1db9309151ff61ffc101c502a434dde9eecdf0cca8b65e76de1ea9c","gemini2-ottoman-020":"796f630fb66c9d50cf1b58a56b807d2f315ab3c3047c0f05540453216e939352","a4-kuwait-history-0407":"ae804600483aa3602fe303f25f14baff891aba91d8665a1666a25ab15ad27fc8","a4-kuwait-history-0410":"20d823fdb679bb2107c41310af3f16823da29eda0f068f0a6f8b5bfca4c2dbaa","gemini2-abbasid-007":"c883a22aa3bab4fbe2b84469aac2e72328372b05a500dda1cbca32b2c0b5ef9c","gemini-juz-amma-b3-020":"4997cbe080793ee360665d411b241384646f22a6fc51d449a24b2f2fa0643364","proverbs-0257":"e0902aea398aef3d28b86d466f833b5e21e7287ca38f6a5c379d380ffc717c15","kuwait-sea-heritage-0053":"e069a11d7d6521cf01b9c87d78b8f384e973b283ce632010f3a2303f6f4d73f6","kuwait-sea-heritage-0216":"9a4e53cab9cd46422e52f209e9806264975a59a21b3c8cf91442ca32131d21ed","kuwait-old-life-0075":"3d7dfd12c10475e453057f93e3ac0c1265d3f869165475c06d9cb7cf85604e60","kuwait-old-life-0114":"a3343537adeeda0cefae8c288984ee3af6098bca56b2ba11b0a9145dc888ee76","kuwait-old-life-0081":"bce4257150f7ef8452248235a11f3e22bc886ef23b2ce29ee7449bb940d262e9","kuwait-old-life-0185":"4568bd21c957b7ba2a959e89f5e536a0fb8462d153e8a2babaa866f3abff5fff","kuwait-old-life-0261":"63d18e82d80af494e381ac1543144b55c2f76a666e2f3ac2c8dcc256340e9a7c","kuwait-old-life-0273":"2cf9364b3e0b11140f4a5701b3006383959288cc0f8ecde32a0b34d2cc1a5138","earth-weather-0238":"cb8c3b188e32f2bb6cf7f3a80e43187d15eba1187415fd3808fb0a50095a7c19","muslim-scientists-0014":"fa0f40891001f442faa2c77a5976a1b134bebc0df5660e1f48646cb44469a141","muslim-scientists-0057":"ec3d14e4e71313a3f29cf6090db17d29f08da0b09898888a3014d658db9890b0","muslim-scientists-0138":"ce93553d074237841bd0fe865dfc6c631854a1c99a380dbc6926a49f581c1e39","muslim-scientists-0187":"8b33f7317b5bda146184ce6a057f443a4d71460a480d1212eac11e201152e3f6","muslim-scientists-0282":"9d162b5318200bcd7f538b0d06b942bd876c55d18547729f1565e2ae6975b21c","muslim-scientists-0285":"6de24dff10fa80f9d169a92095e4f45aef829beb9f4ac4d25cb1f2a3a3b6a0cf","inventions-0123":"34182524d29eedcc9079327b34b0ccf8b86339621db0098e9af16859a6c52acb","palm-plants-0002":"ceb02d5a9345d24478672d46efd01aac857c4586360d243ee6c6dc2632a5b124","palm-plants-0057":"9e65c90c899c32a38d1db548a0e1a191aea59f405000a4abed10076d71ecbe56","palm-plants-0141":"149bd92a459fa2e4178a8273bf0c6057021875addf0a848450b905e5a99394e0","palm-plants-0292":"33ad1760258a4bd63aef7e59dbfab5e5d8a16c7efd3aac1d3fcf9257761228cf","palm-plants-0315":"0ff4827b865163c88a383e4195728e3045dc1fa3504d407b203cfe0ece3f2ae9","horses-camels-falcons-0021":"45b555f89841b41bd06b77ce17a12e9604de2a9c29c40ca6aa3ed4abfb7757dd","horses-camels-falcons-0071":"86cd61925eefa5b490d7c912ec32bf93eddbb64ece2fe4204211baa5194a1dfe","horses-camels-falcons-0055":"743c8e05bae0cec36a1bc8188efd950bd0ee54614d0940b78dc058f90eb068cb","first-aid-0111":"7bcd3ece7133193dd6546946199de2d8fd27190af48fa7c3d5f30650f2855df3","first-aid-0216":"0f3756b5ebf4cd278a06efe4256b1902a641df5d2d637670902432daba025ec1","first-aid-0310":"ba62c391b24e4a6f98fe0b2a1a557d9a7f7de3a464b075d3ad0a718497481ff3","money-economy-0245":"799c753d9a1e9202058b21a8b5df5a654bb1fc097495166ea34440e4e582a1a4","riddles-logic-0001":"39411f7715dce294fcbf123dd94be8c225fd14237c869b86e1917b2c94e0d066","riddles-logic-0002":"f4fdc5eb01d0b9dc5e4417f5adff67dbec08a210dc8ce85bf6406206bae5593a","riddles-logic-0003":"039677a371beafd1f53346310016566a25de6a3005207429345e04e3b7670a99","riddles-logic-0004":"a6c4e3d3db9fe8870853b6e839cab61e88949b97b78b0b7c073700d79d402db1","riddles-logic-0005":"6506ea2e3ad5bb737ac62ca94a15c388354575888216bb1d74d67391da1ac078","riddles-logic-0006":"1cee94bd70578523ef71b87ae90f32608a00b75f363f5516f671663a31b2f7d3","riddles-logic-0008":"13420b8a08618f43c2e88c3fcf60aa0d9ecf287e1b4a6dbf0834f678e2ebcbf7","riddles-logic-0009":"18a43961d31278459b6efeb05ab8f068808ce324bcb267e966c8c415030848ca","riddles-logic-0012":"7db63fdf534d4e8c429e5c1a929a298db99fa184392f25fed70c6af1ed1b7a81","riddles-logic-0015":"e82023d4892b45c2b387f9190dbbcfaba96f93cab2edd4c0a1fdee0ae7a0931a","riddles-logic-0019":"1abb717dace1be995b5b3f98dc70669847d2e32c974359c6369f308f54c70109","riddles-logic-0022":"c0b7c6f91c4c03ff450af60758d52b08570fc7426fad528ec5523adbc9af2c8c","riddles-logic-0023":"eca52e4183e8c008552f2160d2ad3fa5e7878ebf7cf468f532d245d69fbea555","riddles-logic-0024":"054e4a19a1ae72397216e32be07b6b0008974f1c81d7343894961552c0396828","riddles-logic-0025":"5b2576d1cccdc104fb28ff184edb0004aee5b837a5aa77924bb5a3bfff127512","riddles-logic-0027":"3331cac0c736967b674272f5c9300dddfff8c8c7c51f58c2993f19acf8fc0d56","riddles-logic-0028":"9a65a5a07d5d5998f9d791fb60f44570d1ebba44d3831795f4443a523ae473d0","riddles-logic-0034":"30808e6a0950ddb3d96187af445b51df44f407bbb42ad69b1613f28c165adab3","riddles-logic-0037":"d576e870187db73f80589b9105bb571adafc17b7a10c1532078b1c000d088df6","riddles-logic-0038":"205cae6e3cde04e25d5d25c83d5e4fd3f6926d13a20d80bcc2c29e7a7b6f808d","riddles-logic-0039":"deb861c32917e95aa4cfa1686b0d6b6cffa1dc53022116e8502b80b900332994","riddles-logic-0049":"f689c3d19d00acfcca0cbb1a5429ff80f2913f3fb79991c806d6cbd8eaef2d15","riddles-logic-0051":"969de6970b428b50d396d6080c87a0f5c1ff1ca4a5e0580a2d04c21628959b25","riddles-logic-0059":"38fe613e7d4e2cc0e8c09e394c3b8ce06c2717a1365f175b3fcd733bfaa134c8","sahaba-0192":"06a2cdf60610635f22cee5983728059f893dbaa914efedb198e86bb580548be8","sahaba-0161":"5f816a9de741491e941d39254dd46b0eca8f724d00a62257e7426aa789ba1748","sahaba-0228":"0132c35d464c34d6b8dc0b210ffff79a62ed4b602037489e5fbcd5fc35f8e73c","mothers-ahlulbayt-0058":"2c4c634b46a30a7679a6fb6040d7d1c1a50a3c748638f4d04fb5b540195c9171","mothers-ahlulbayt-0336":"78217ff40af76b7074429272c222f531a3156374e478df4a6f6668dba773cd9e","tajweed-0186":"2836069ddbdb56d210102155a6e88c96e4f0003ff292c9597f1bce4858274c75","asmaa-husna-0023":"ad7cf4b88471f06e80dd58e9a67e4516fbf2aeffdc84842fa7bd0c82daf69e58","easy-fiqh-0033":"88068d930f900291a30ee4bd8bb920ea240df59dac6cb7146bc9f1432233e126","easy-fiqh-0091":"800fa799d528d7dac82f9121a1ee5b723d6877eb50c2b053a74dccb46c80a216","easy-fiqh-0127":"6cf7e7db66f3d32ad6ad0ef55707120bba6269303433f0187abb0891b4f387ac","easy-fiqh-0323":"28bec406db0e4cda2b9e5b6ad97b5775868f0194a8d0b34a76ddd1c8e2ead28d","easy-fiqh-0347":"2ac597f9d7425dbe16f7e5a1b2bfa998b8654ae04f9f70ab530ddd4228748979","a5-hadith-0068":"835a3dc16a55a92cfb4b20155576a287e0e449f1bc1d84c0198dbf5ac9d6c32a","asmaa-husna-0093":"1377417417e2acda487b1ab17d7f3c3e92a3e05a2455133d3dc74a38e2af7f6d","gemini-umayyad-b2-007":"5f35ccb8f0302c9694bc3e73e52597e8828463e89cd9dc06bd7f498ddf37f480","gemini2-umayyad-002":"f8018f38b1f4c558b78dd6e0807a471a58d81f62d250720d752b75343a3b7d5f","gemini-rashidun-004":"f170139a48a772528dba0a358aaf74b081e1f854bad1373450182f2f5d3514e6","gemini-rashidun-b2-005":"e3b7201bcd672728349c815091bf5bba45c5eee3c1f00b3e5fbe90046acbd50c","gemini-rashidun-b2-020":"193e1fa17aa8d8ae0d1350de2de7278edd40e7c415fabe7062a2a4c039e18388","gemini-rashidun-b3-015":"4b2ab2b13c8e264b0bab3f08432beeadd67b1c1aa70531bd760071931ac828c1","gemini2-umayyad-001":"265c281707c2bb4726582ee56780525ff8a2b6fb65cd08e9653ab62766fb6f3b","gemini2-umayyad-005":"30ee075ffcb5582f7a6f10ca1717417c3dd0b4f39e820cc0a7c34d38e4137837","gemini-rashidun-b2-010":"d46dacd8bb5c22174f8c9573b993c5e6fb6a216977829cfbe92455e949c92669"};
const BANK_LIVE = 10423;
const BANK_PREFIX = 10935, BANK_PREFIX_STAMP = '10935-8601a1af';   // the pages' seenStamp() of the bank as it stood before
const RETIRED = new Set(["poetry-fusha-0146","poetry-fusha-0147","poetry-fusha-0148","poetry-fusha-0149","poetry-fusha-0150","poetry-fusha-0151","poetry-fusha-0152","poetry-fusha-0153","poetry-fusha-0154","poetry-fusha-0155","poetry-fusha-0156","poetry-fusha-0157","poetry-fusha-0158","poetry-fusha-0159","poetry-fusha-0160","poetry-fusha-0161","poetry-fusha-0162","poetry-fusha-0163","poetry-fusha-0164","poetry-fusha-0165","poetry-fusha-0166","poetry-fusha-0167","poetry-fusha-0168","poetry-fusha-0169","poetry-fusha-0170","poetry-fusha-0171","poetry-fusha-0172","poetry-fusha-0173","poetry-fusha-0174","poetry-fusha-0175","poetry-fusha-0176","poetry-fusha-0177","poetry-fusha-0178","poetry-fusha-0179","poetry-fusha-0180","poetry-fusha-0181","poetry-fusha-0182","poetry-fusha-0183","poetry-fusha-0184","poetry-fusha-0185","poetry-fusha-0187","poetry-fusha-0188","poetry-fusha-0189","poetry-fusha-0190","poetry-fusha-0348","poetry-fusha-0349","poetry-fusha-0350","poetry-fusha-0351","poetry-fusha-0352","poetry-fusha-0353","poetry-fusha-0354","poetry-fusha-0355","poetry-fusha-0356","poetry-fusha-0357","poetry-fusha-0358","poetry-fusha-0359","poetry-fusha-0360","poetry-nabati-0004","poetry-nabati-0005","poetry-nabati-0006","poetry-nabati-0007","poetry-nabati-0008","poetry-nabati-0009","poetry-nabati-0012","poetry-nabati-0015","poetry-nabati-0016","poetry-nabati-0018","poetry-nabati-0019","poetry-nabati-0020","poetry-nabati-0021","poetry-nabati-0022","poetry-nabati-0023","poetry-nabati-0024","poetry-nabati-0025","poetry-nabati-0026","poetry-nabati-0029","poetry-nabati-0031","poetry-nabati-0033","poetry-nabati-0034","poetry-nabati-0035","poetry-nabati-0037","poetry-nabati-0038","poetry-nabati-0039","poetry-nabati-0041","poetry-nabati-0042","poetry-nabati-0043","poetry-nabati-0045","poetry-nabati-0047","poetry-nabati-0048","poetry-nabati-0049","poetry-nabati-0050","poetry-nabati-0051","poetry-nabati-0052","poetry-nabati-0054","poetry-nabati-0055","poetry-nabati-0057","poetry-nabati-0060","poetry-nabati-0061","poetry-nabati-0062","poetry-nabati-0064","poetry-nabati-0066","poetry-nabati-0070","poetry-nabati-0071","poetry-nabati-0073","poetry-nabati-0075","poetry-nabati-0076","poetry-nabati-0078","poetry-nabati-0080","poetry-nabati-0081","poetry-nabati-0082","poetry-nabati-0083","poetry-nabati-0084","poetry-nabati-0088","poetry-nabati-0089","poetry-nabati-0090","poetry-nabati-0091","poetry-nabati-0093","poetry-nabati-0094","poetry-nabati-0095","poetry-nabati-0096","poetry-nabati-0098","poetry-nabati-0099","poetry-nabati-0100","poetry-nabati-0102","poetry-nabati-0103","poetry-nabati-0105","poetry-nabati-0108","poetry-nabati-0109","poetry-nabati-0111","poetry-nabati-0112","poetry-nabati-0113","poetry-nabati-0114","poetry-nabati-0115","poetry-nabati-0116","poetry-nabati-0117","poetry-nabati-0118","poetry-nabati-0129","poetry-nabati-0142","poetry-nabati-0143","poetry-nabati-0148","poetry-nabati-0151","poetry-nabati-0154","poetry-nabati-0155","poetry-nabati-0156","poetry-nabati-0157","poetry-nabati-0159","poetry-nabati-0162","poetry-nabati-0163","poetry-nabati-0164","poetry-nabati-0166","poetry-nabati-0167","poetry-nabati-0169","poetry-nabati-0170","poetry-nabati-0172","poetry-nabati-0173","poetry-nabati-0174","poetry-nabati-0175","poetry-nabati-0176","poetry-nabati-0179","poetry-nabati-0180","poetry-nabati-0181","poetry-nabati-0183","poetry-nabati-0185","poetry-nabati-0186","poetry-nabati-0187","poetry-nabati-0189","poetry-nabati-0198","poetry-nabati-0199","poetry-nabati-0201","poetry-nabati-0202","poetry-nabati-0204","poetry-nabati-0217","poetry-nabati-0219","poetry-nabati-0220","poetry-nabati-0221","poetry-nabati-0225","poetry-nabati-0226","poetry-nabati-0231","poetry-nabati-0232","poetry-nabati-0233","poetry-nabati-0235","poetry-nabati-0239","poetry-nabati-0240","poetry-nabati-0242","poetry-nabati-0245","poetry-nabati-0251","poetry-nabati-0253","poetry-nabati-0254","poetry-nabati-0255","poetry-nabati-0257","poetry-nabati-0260","poetry-nabati-0261","poetry-nabati-0264","poetry-nabati-0266","poetry-nabati-0267","poetry-nabati-0268","poetry-nabati-0269","poetry-nabati-0271","poetry-nabati-0274","poetry-nabati-0275","poetry-nabati-0276","poetry-nabati-0277","poetry-nabati-0281","poetry-nabati-0284","poetry-nabati-0310","poetry-nabati-0311","poetry-nabati-0312","poetry-nabati-0316","poetry-nabati-0317","poetry-nabati-0319","poetry-nabati-0330","poetry-nabati-0332","poetry-nabati-0336","poetry-nabati-0342","poetry-nabati-0344","poetry-nabati-0347","poetry-nabati-0353"]);
const BANK_CATEGORIES = 53;
const KUNUZ_MODES = ['quest-ghaws.html', 'quest-harb.html', 'quest-test.html', 'quest-board.html'];   // KUNUZ-TEST (2026-10-16): the fourth game, «اختبر معلوماتك»; KUNUZ-BOARD (2026-10-16): the board game
const KUNUZ_HUB = 'quest.html';

// ---------------------------------------------------------------------------
// THE SEALED FILES -- thirteen until item 10, six since: the eight quest-data files of
// the old journey left with it and the one shared Kunuz bank took their place. Every
// file here carries scripture, adhkar, the mushaf layout, the question bank, or the
// two files that decide what a phone installs and caches. None of them may move without the seal being re-cut deliberately.
//
// This list used to live in chat-ux-guard.cjs, inside the ELSE arm of a
// `git diff --name-only HEAD` probe. When git was absent -- a fresh export, a
// container, any CI image without .git -- the probe threw, the guard reported
// one honest failure about the blast radius, and the seal below it NEVER RAN.
// A reader saw a single red line about git and read it as harmless plumbing;
// the thirteen went unchecked. The most valuable guarantee in the repository
// cannot be a passenger on a `git` lookup, and it does not belong inside a
// user-experience guard at all. It runs here, unconditionally, and a mismatch
// prints the file, the expected digest and the actual one.
// ---------------------------------------------------------------------------
const SEALED = {
  // ITEM 10: the shared Kunuz bank, sealed at acceptance (3DC06F40, 1535845 bytes, 3147 questions)
  // and re-cut 2026-10-13 when the owner removed two questions (BE327C28, 1534695 bytes, 3145) and again the same day when
  // the 26 new categories joined, appended after the old 27 (646738ED, 5430943 bytes, 10935 questions, 53 categories). One line
  // of JavaScript, no newline, so no line-ending conversion can move it; pinned -text anyway.
  // and again 2026-10-19 (KUNUZ-LEVELS-POETRY, B): 217 poets' private-life questions retired in place and 101 verse questions
  // appended (EA0F7962, 5412585 bytes, 11036 rows, 10819 live).
  'quest-data/kunuz-bank-3147.js': '73835acc3ff7d7ee3cd3e9a043452bf07ba2531c891cc10d43092788044d87d3',
  'quran-uthmani.json': 'd4fd1a1507f70a4261789eaec8380750cd0f65f4d641f6df2ef6334b18c6877b',
  'adhkar.json': '19ef96b9ecc275376d46a667a86297261ea5991749ffe46dd35448196cb4c9c3',
  'mushaf-layout.json': 'ea9223ef7f18b5d933ce1c87cbebabc5d78f1ec0e8ac9714260f9dee6d571351',
  // D09: these two are sealed on LF BYTES. They were sealed on this machine's CRLF
  // working copy (manifest 549 b / sw 5044 b) while git stored LF (533 b / 4944 b), so
  // the seal held here and broke in every fresh clone and every CI run on Linux. Both
  // now carry `text eol=lf` in .gitattributes, so what is checked out is what is sealed.
  // Re-cut these only from a tree measured at CR = 0.
  'manifest.json': 'b542ce84b30e12d3cc517ee51ba628ac6a669714792063d8d606678305730434',
  // Re-cut history for this one file, newest first. Measured on this tree at CR = 0
  // every time, as the note above requires.
  //   2026-09-15-d -- SIDE ROUND, ITEM 66: THE DIAL IS THE PRESS THAT STARTS THE SENSOR.
  //                    INDEX.HTML DID NOT MOVE and NO FILE JOINED OR LEFT CORE: the whole item is
  //                    app.jsx -- the compass screen's mount effect no longer starts the browser
  //                    orientation sensor (a passive effect is off the gesture, and Safari refuses
  //                    the orientation prompt outside one), and the circle itself now answers the
  //                    touch instead. No element was added and nothing was drawn: one handler
  //                    moved onto the dial that was already there. So the shell figure and its
  //                    mirror were already true and only the BUNDLE figures moved. app.js was
  //                    rebuilt from app.jsx by node tools/build-app.cjs, 1749779 -> 1749677
  //                    (-102), and CORE_BYTES was re-cut 2922869 -> 2922767 (-102) by node
  //                    tools/core-bytes.cjs --write, which is exactly the bundle delta because
  //                    nothing but app.js changed size in CORE. The worker's own byte table at
  //                    :142 and the SW_PROSE row for app.js below both followed, and THIS digest
  //                    is re-cut LAST, after every other sw.js edit was final. SW.JS IS OTHERWISE
  //                    UNTOUCHED -- no route, no store and no branch of it moved -- and CACHE IS
  //                    NOT BUMPED: this is a branch for the owner to try, not a ship, and sw.js
  //                    says the merge round owns the bump.
  //   2026-09-15-c -- SIDE ROUND, ITEM 66: THE COMPASS KEEPS ONE ENTRY AND THE TOP BAR'S MARK
  //                    IS LIFTED. INDEX.HTML DID NOT MOVE and NO FILE JOINED OR LEFT CORE: the
  //                    whole item is app.jsx -- the home's top bar loses the compass button, the
  //                    prop that fed it and the view object's handler key, and the one entry left
  //                    is the mark in the head of the «الصلاة والقبلة» sheet. So the shell figure and
  //                    its mirror were already true and only the BUNDLE figures moved. app.js was
  //                    rebuilt from app.jsx by node tools/build-app.cjs, 1751037 -> 1749779
  //                    (-1258), and CORE_BYTES was re-cut 2924127 -> 2922869 (-1258) by node
  //                    tools/core-bytes.cjs --write, which is exactly the bundle delta because
  //                    nothing but app.js changed size in CORE. The worker's own byte table at
  //                    :142 and the SW_PROSE row for app.js below both followed, and THIS digest
  //                    is re-cut LAST, after every other sw.js edit was final. SW.JS IS OTHERWISE
  //                    UNTOUCHED -- no route, no store and no branch of it moved -- and CACHE IS
  //                    NOT BUMPED: this is a branch for the owner to try, not a ship, and sw.js
  //                    says the merge round owns the bump.
  //   2026-09-15-b -- SIDE ROUND, ITEM 8: THE REMINDERS LEAVE THE SETTINGS FOR «وِردي اليوم»,
  //                    FOUR OF THEM ARE ANCHORED TO PRAYER TIMES, AND THE SIXTY-ITEM CEILING
  //                    BECOMES A GATE INSTEAD OF A COMMENT. INDEX.HTML DID NOT MOVE and NO FILE
  //                    JOINED OR LEFT CORE: the whole item is app.jsx -- one new device key, four
  //                    alert rows built from the page's own prayer calculator, a reminder carried
  //                    on each wird row, and a priority cut applied before the payload is built.
  //                    So the shell figure and its mirror were already true and only the BUNDLE
  //                    figures moved. app.js was rebuilt from app.jsx by node tools/build-app.cjs,
  //                    1720695 -> 1751037 (+30342), and CORE_BYTES was re-cut 2893785 -> 2924127
  //                    (+30342) by node tools/core-bytes.cjs --write, which is exactly the bundle
  //                    delta because nothing but app.js changed size in CORE. The worker's own
  //                    byte table at :142 and the SW_PROSE row for app.js below both followed,
  //                    and THIS digest is re-cut LAST, after every other sw.js edit was final.
  //                    SW.JS IS OTHERWISE UNTOUCHED -- no route, no store and no branch of it
  //                    moved -- and CACHE IS NOT BUMPED: this is a branch for the owner to try,
  //                    not a ship, and sw.js says the merge round owns the bump.
  //   2026-09-15-a -- SIDE ROUND, ITEM 66: THE COMPASS SCREEN PAINTS AT ONCE AND SAYS NOTHING.
  //                    INDEX.HTML DID NOT MOVE and NO FILE JOINED OR LEFT CORE: the whole item is
  //                    app.jsx -- the qibla panel gained one presentation flag that its full-screen
  //                    caller alone passes, the shell gained one slot beside its back button, and
  //                    the layer dispatch put the compass above the prayer sheet so the sheet's
  //                    header can open it. So the shell figure and its mirror were already true and
  //                    only the BUNDLE figures moved. app.js was rebuilt from app.jsx by node
  //                    tools/build-app.cjs, 1713640 -> 1720695 (+7055), and CORE_BYTES was re-cut
  //                    2886730 -> 2893785 (+7055) by node tools/core-bytes.cjs --write, which is
  //                    exactly the bundle delta because nothing but app.js changed size in CORE.
  //                    The worker's own byte table at :142 and the SW_PROSE row for app.js below
  //                    both followed, and THIS digest is re-cut LAST, after every other sw.js edit
  //                    was final. SW.JS IS OTHERWISE UNTOUCHED -- no route, no store and no branch
  //                    of it moved -- and CACHE IS NOT BUMPED: this is a branch for the owner to
  //                    try, not a ship, and sw.js says the merge round owns the bump.
  //   2026-09-13-i -- ITEM 92-ج: THE «عن عزك» MATN IS REPLACED AND المصادر BECOMES THE
//                    WHOLE LIST. INDEX.HTML DID NOT MOVE and NO FILE JOINED CORE: both matns
//                    still ship as SOURCE, which is why they were not made data files in the
//                    round that introduced them -- 4 paragraphs, 7 section headings and 54
//                    credit lines, none of them fetched, cached or read from a store. So the
//                    shell figure and its mirror were already true and only the BUNDLE figures
//                    moved. app.js was rebuilt from app.jsx by node tools/build-app.cjs,
//                    1647056 -> 1652685 (+5629), and CORE_BYTES was re-cut 2735387 -> 2741016
//                    (+5629) by node tools/core-bytes.cjs --write, which is exactly the bundle
//                    delta because nothing but app.js changed size in CORE. The worker's own
//                    byte table at :121 and the SW_PROSE row for app.js below both followed,
//                    and THIS digest is re-cut LAST, after every other sw.js edit was final.
//                    SW.JS IS OTHERWISE UNTOUCHED -- no route, no store and no branch of it
//                    moved -- and CACHE IS NOT BUMPED: this is a branch for the owner to try,
//                    not a ship, and sw.js says the merge round owns the bump.
  //   2026-09-13-h -- ITEM 92-ب: FOUR ROWS IN THE SIDE MENU, TWO FIXED-TEXT PANELS AND ONE
//                    FEEDBACK FORM. INDEX.HTML DID NOT MOVE this round -- the rows, the panels
//                    and the form are app.jsx, the new endpoint is api/feedback.js (a server
//                    route, not a shipped asset, so NOT in CORE and not in .gitattributes), and
//                    NO FILE JOINED CORE at all: the two matns ship as source, which is exactly
//                    why they were not made data files. So the shell figure and its mirror were
//                    already true and only the BUNDLE figures moved. app.js was rebuilt from
//                    app.jsx by node tools/build-app.cjs, 1629141 -> 1647056 (+17915), and
//                    CORE_BYTES was re-cut 2717472 -> 2735387 (+17915) by node
//                    tools/core-bytes.cjs --write, which is exactly the bundle delta because
//                    nothing but app.js changed size in CORE. The worker's own byte table at
//                    :121 and the SW_PROSE row for app.js below both followed, and THIS digest
//                    is re-cut LAST, after every other sw.js edit was final. SW.JS IS OTHERWISE
//                    UNTOUCHED -- no route, no store and no branch of it moved -- and CACHE IS
//                    NOT BUMPED: this is a branch for the owner to try, not a ship, and sw.js
//                    says the merge round owns the bump.
  //   2026-09-13-g -- ITEM 4: THE FORTY'S FOOTNOTES JOIN CORE, AND app.js GREW TO DRAW THEM.
  //                    arbaeen.json carries the print edition's footnote markers inside its own
  //                    text -- 55 of them -- and nothing answered any of them. The footnote text
  //                    was joined to the marks from the source atoms by the new, deterministic
  //                    tools/arbaeen-footnotes-build.cjs and shipped as arbaeen-footnotes.json
  //                    (9322 bytes, AD25D24A), which is now named in CORE beside arbaeen.json
  //                    with its own prose line. IT IS IN CORE FOR A REASON THE OTHER DATA
  //                    ENTRIES DO NOT HAVE: the reader draws a mark only when this file answers
  //                    it, so a precached corpus whose notes were NOT precached would give an
  //                    offline reader the same hadith with every mark stripped out of it.
  //                    arbaeen.json ITSELF WAS NOT WRITTEN -- it was read, and its digest above
  //                    is the one 2026-09-13-e recorded. app.js was rebuilt from app.jsx by node
  //                    tools/build-app.cjs, 1619590 -> 1629141 (+9551), and CORE_BYTES was
  //                    re-cut 2698599 -> 2717472 (+18873, exactly 9322 + 9551) by node
  //                    tools/core-bytes.cjs --write. The worker's own byte table gained the new
  //                    file in its existing descending order and restated app.js; SW_CORE and
  //                    SW_CORE_FILES gained the entry in CORE's order, and SW_PROSE gained a row
  //                    for it and restated app.js, so B12 and B14 re-derive both numbers rather
  //                    than trusting them. THIS digest is re-cut LAST, after every other sw.js
  //                    edit was final. THE CACHING STRATEGY IS UNTOUCHED: the fetch handler, the
  //                    sealed-mushaf exclusion and the revalidation branch are exactly as they
  //                    were. CACHE is NOT bumped: the merge round owns the bump.
  //   2026-09-13-f -- ITEM 2: TWO CORPORA JOIN THE WORKER'S CORE LIST. arbaeen.json (67360
  //                    bytes, 36B6DF66) and daily-tafsir.json (23984 bytes, E26E09F1) were
  //                    fetched from the origin root on first open and cached only by the
  //                    runtime rule, so a first open with NO NETWORK drew two empty sections.
  //                    Both are now named in CORE beside the other data entries, each with a
  //                    prose line in the array's own voice. NEITHER CORPUS WAS WRITTEN -- both
  //                    were read for their size and nothing else, and their digests above are
  //                    the same ones 2026-09-13-e recorded. CORE_BYTES was re-cut 2607255 ->
  //                    2698599 (+91344, exactly 67360 + 23984) by node tools/core-bytes.cjs
  //                    --write. The worker's own byte table, now at :125, gained both figures
  //                    in its existing descending order; SW_CORE and SW_CORE_FILES gained both
  //                    entries in CORE's order, and SW_PROSE gained a row for each, so B12 and
  //                    B14 re-derive the two new numbers rather than trusting them. THIS digest
  //                    is re-cut LAST, after every other sw.js edit was final. THE CACHING
  //                    STRATEGY IS UNTOUCHED: the fetch handler, the sealed-mushaf exclusion
  //                    and the revalidation branch are all exactly as they were. CACHE is NOT
  //                    bumped: sw.js says the merge round owns the bump, and install rewrites
  //                    every CORE entry into the same store.
  //   2026-09-13-e -- THE FORTY, AMENDED: THE CORPUS'S LATIN COMMA IS DRAWN AS AN ARABIC ONE,
  //                    AND THE HEADING CAP MOVES 40 -> 56. Both changes live entirely inside
  //                    arbaeenTopic in app.jsx, which is a DISPLAY derivation: arbaeen.json is
  //                    not touched (67360 bytes, 36B6DF66, unchanged), the reader's attribution
  //                    line still prints the corpus's own heading verbatim, and index.html did
  //                    not move, which is why no shell figure did. Thirteen of the fifty headings
  //                    lose a space before the mark and gain U+060C in its place; the wider cap
  //                    takes the elided headings from eleven to three. app.js was rebuilt
  //                    1618438 -> 1619590 (+1152) by node tools/build-app.cjs, and CORE_BYTES
  //                    re-cut 2606103 -> 2607255 (+1152, exactly the bundle delta) by node
  //                    tools/core-bytes.cjs --write. The worker's own byte table at :121 and the
  //                    SW_PROSE row for app.js both followed, and THIS digest is re-cut LAST.
  //                    SW.JS IS OTHERWISE UNTOUCHED: one integer and one figure in prose. CACHE
  //                    is NOT bumped: install rewrites every CORE entry into the same store.
  //   2026-09-13-d -- ITEM 1-A / 1-B / 3, THE FORTY: PREVIOUS AND NEXT, THE LIST'S OWN PLACE,
  //                    AND A HEADING DERIVED FROM THE ENTRY. The reader now holds the INDEX of
  //                    the entry being read instead of the entry object, so it can step either
  //                    way; returning centres the card the reader was last inside; and the card's
  //                    heading is read out of the entry's own text rather than being the ordinal
  //                    the corpus stores. arbaeen.json IS NOT TOUCHED -- 67360 bytes, 36B6DF66,
  //                    before and after -- and neither is index.html, which is why no shell
  //                    figure moved. app.jsx is the only edited source. app.js was rebuilt
  //                    1607416 -> 1618438 (+11022) by node tools/build-app.cjs, and CORE_BYTES
  //                    re-cut 2595081 -> 2606103 (+11022, exactly the bundle delta, because the
  //                    shell did not grow) by node tools/core-bytes.cjs --write. The worker's own
  //                    byte table at :121 and the SW_PROSE row for app.js both followed, and THIS
  //                    digest is re-cut LAST. SW.JS IS OTHERWISE UNTOUCHED: what moved inside it
  //                    is one integer and one figure in prose. CACHE is NOT bumped: install
  //                    rewrites every CORE entry into the same store.
  //   2026-09-13-c -- ITEM 94, THE BARCODE: THE FORMAT STRIP WAS WRITTEN BACKWARDS.
  //                    The symbol on the card was right in every part a reader looks at LAST --
  //                    finders, timing, alignment, data words, error correction, mask 4, quiet
  //                    zone -- and wrong in the fifteen modules a reader looks at FIRST. The
  //                    format word was indexed from its low bit, so all fifteen were laid down
  //                    in reverse (nine of the thirty modules dark where they should be light),
  //                    and the second copy was taken eight modules up the left column instead of
  //                    seven, which shifted it by one and overwrote the dark module besides. No
  //                    scanner reads that. ezikQrPutFormat in app.jsx is the ONLY changed
  //                    function; the encoder, the payload, the skin and index.html did not move.
  //                    app.js was rebuilt 1606644 -> 1607416 (+772) by node tools/build-app.cjs,
  //                    and CORE_BYTES re-cut 2594309 -> 2595081 (+772, exactly the bundle delta)
  //                    by node tools/core-bytes.cjs --write. The worker's own byte table at :121
  //                    and the SW_PROSE row for app.js both followed, and THIS digest is re-cut
  //                    LAST. CACHE is NOT bumped: install rewrites every CORE entry into the
  //                    same store.
  //   2026-09-13-b -- ITEM 94, ROUND TWO: THE CARD'S SKIN WAS REPLACED AGAIN, AND ONLY THE SKIN.
  //                    The owner read three skins and ruled on the band-and-rows one: white page,
  //                    ezik's light blue, no phrase at all under the bottom strip's ruler, the
  //                    barcode leading to ezik rather than to the source, and a shape GENERATED
  //                    per question out of a closed six-key grammar rather than one template
  //                    repeating. Everything is in app.jsx: the structure check narrowed to two
  //                    to four points, a fourteen-key vector diagram library, the grammar and its
  //                    resolver, the locked palette, the layout and the painter. The QR encoder,
  //                    the fallback to the old skin and the pinned output line are untouched.
  //                    index.html DID NOT MOVE. app.js was rebuilt 1584918 -> 1606644 (+21726) by
  //                    node tools/build-app.cjs, and CORE_BYTES re-cut 2572583 -> 2594309
  //                    (+21726, which is exactly the bundle delta) by node tools/core-bytes.cjs
  //                    --write. The worker's own byte table at :121 and the SW_PROSE row for
  //                    app.js below both state that size and both were restated. THIS digest is
  //                    re-cut last. CACHE is NOT bumped: install rewrites every CORE entry into
  //                    the same store.
  //   2026-09-13   -- ITEM 94: THE SHARE CARD IS A SUMMARY NOW, AND THE SKIN THAT POURED THE WHOLE
  //                    REPLY OUT IS THE FALLBACK BEHIND IT. All of it is in app.jsx: a closed-
  //                    structure summary asked of the model at the press, a structure check that
  //                    falls back rather than repairs, a QR encoder (byte mode, versions 2..6,
  //                    levels M then L) drawn as fillRect squares on the card's own context, and
  //                    the new layout. index.html DID NOT MOVE. app.js was rebuilt 1550360 ->
  //                    1584918 (+34558) by node tools/build-app.cjs, and CORE_BYTES re-cut
  //                    2538025 -> 2572583 (+34558, which is exactly the bundle delta) by node
  //                    tools/core-bytes.cjs --write. The worker's own byte table at :121 and the
  //                    SW_PROSE row for app.js below both state that size and both were restated.
  //                    THIS digest is re-cut last. CACHE is NOT bumped: install rewrites every
  //                    CORE entry into the same store.
  //   2026-09-10   -- ITEM 85: THE BOOT REACHES ONE ORIGIN, AND IT IS THIS ONE. index.html linked a
  //                    render-blocking stylesheet on fonts.googleapis.com, and with that origin
  //                    unreachable the diagnostic catcher put a full-viewport black panel over a
  //                    working app. The 21 .woff2 files Google served for that URL are now in
  //                    fonts/ under the vendor's own names, declared by 31 @font-face rules with
  //                    the same weights, unicode-ranges and font-display: swap; the three
  //                    preconnects and the link are gone; and a resource that fails to load is
  //                    recorded in __ezikDiag without building the panel. THE SHELL GREW, a lot:
  //                    index.html 124729 -> 152137 (+27408), of which 24183 is the @font-face
  //                    block, 2327 the catcher's new branch and its reasoning, and 1610 the
  //                    register of the three origins that stay. app.js DID NOT MOVE -- app.jsx was
  //                    not touched and gate babel still passes on the committed bundle. sw.js lost
  //                    its two-hostname exception to the !sameOrigin return (fonts are same-origin
  //                    now and fall to the arm that was already there) and CORE gained the two
  //                    Noto Naskh Arabic cuts the first screen actually pulls, measured in a cold
  //                    headless boot: 94032 + 19696 = 113728. So CORE_BYTES was re-cut by node
  //                    tools/core-bytes.cjs --write 2266648 -> 2407784 (+141136 = +27408 shell
  //                    +113728 faces), and SW_CORE, SW_CORE_FILES and three SW_PROSE rows below
  //                    followed. The worker's own byte table at :121 and its CACHE note at :57
  //                    both state the shell size and both were restated. THIS digest is re-cut
  //                    LAST, on a tree measured at CR = 0. CACHE IS NOT BUMPED: this is a branch
  //                    for the owner to preview, not a ship.
  //   2026-09-10   -- ITEM 63: THE FOUR FATWA LEARNING BUTTONS THAT DO NOTHING ARE HIDDEN. The
  //                    owner ruled that simplify / example / explain / quiz are hidden rather than
  //                    built or deleted, so app.jsx gained one constant, EZIK_FATWA_ACTIONS_SHOWN,
  //                    and the render of the list now hangs off it. Setting it to true shows them
  //                    again, still disabled -- that one line IS the rollback. The list, the .map
  //                    body, the five fatwa.action.* keys in both language halves and every .ezf-*
  //                    rule are untouched; .ezf-action is shared with the SAVE button, which keeps
  //                    its size to the pixel (measured 147x44 at 360 and 162x44 at 390, on both
  //                    trees). INDEX.HTML DID NOT MOVE -- everything is in app.jsx and one guard --
  //                    so two of the three worker figures and one of the two mirrors below were
  //                    already true and only the BUNDLE figures moved. app.js was rebuilt
  //                    1421673 -> 1421956 (+283) by node tools/build-app.cjs, and CORE_BYTES was
  //                    re-cut 2266365 -> 2266648 (+283) by node tools/core-bytes.cjs --write, which
  //                    is exactly the bundle delta because the shell did not grow. The worker table
  //                    at :111 and the app.js mirror below followed, and THIS digest is re-cut LAST.
  //                    SW.JS IS OTHERWISE UNTOUCHED and CACHE IS NOT BUMPED: this is a branch for
  //                    the owner to preview, not a ship.
  //   2026-09-10   -- ITEM 92 PART B: THE IN-APP SHARE GIVES A SMART LINK. https://ezik.app IS the
  //                    app, not a way to install it, so the shells now hand over one address that
  //                    decides for whoever opens it -- https://ezik.app/download.html. The new root
  //                    page sends an iPhone or iPad to the App Store, an Android device to Google
  //                    Play, and everybody else sees both official badges as links; the deciding is
  //                    done by download.js, on that page, and the app's own shell detection still
  //                    never reads a user agent. The browser chooser part A built did not change.
  //                    INDEX.HTML DID NOT MOVE this round either -- everything is in app.jsx, one
  //                    guard and two new root files -- so two of the three worker figures and one of
  //                    the two mirrors below were already true and only the BUNDLE figures moved.
  //                    app.js was rebuilt 1420540 -> 1421673 (+1133) by node
  //                    tools/build-app.cjs, and CORE_BYTES was re-cut 2265232 -> 2266365 (+1133) by
  //                    node tools/core-bytes.cjs --write, which is exactly the bundle delta because
  //                    the shell did not grow. The worker table at :111 and the app.js mirror below
  //                    followed, and THIS digest is re-cut LAST. SW.JS IS OTHERWISE UNTOUCHED: its
  //                    navigation branch is already network-FIRST, so the new page is served by the
  //                    server and not from the cached app, exactly as about.html is. CACHE IS NOT
  //                    BUMPED: this is a branch for the owner to try, not a ship.
  //   2026-09-10   -- ITEM 92: THE MENU GAINED A SHARE BUTTON, AND WHAT IT HANDS OVER DEPENDS ON
  //                    WHERE THE READER IS. Inside the mobile shells it shares https://ezik.app and
  //                    nothing else -- no chooser is built there, so no badge file and no store or
  //                    platform name can reach the page, which is App Store Review Guideline 2.3.10.
  //                    In a plain browser it opens a small chooser: Apple's own badge, Google's own
  //                    badge, then both links as text. Apple is first because Apple's badge guideline
  //                    requires it when another platform's badge is beside it. The two badges are the
  //                    VENDORS' OWN FILES, byte for byte from apple.com and google.com, and the new
  //                    gate `sharelinks` seals each by SHA-256. INDEX.HTML DID NOT MOVE this round --
  //                    everything is in app.jsx, two guards and four censuses -- so two of the three
  //                    worker figures and one of the two mirrors below were already true and only the
  //                    BUNDLE figures moved. app.js was rebuilt from that source 1408320 -> 1420540
  //                    (+12220) by node tools/build-app.cjs, and CORE_BYTES was re-cut 2253012 ->
  //                    2265232 (+12220) by node tools/core-bytes.cjs --write, which is exactly the
  //                    bundle delta because the shell did not grow. The worker table at :111 and the
  //                    app.js mirror below followed, and THIS digest is re-cut LAST. CACHE IS NOT
  //                    BUMPED: this is a branch for the owner to try, not a ship, and sw.js says the
  //                    merge round owns the bump.
  //   2026-09-10   -- ITEM 75: SUMMARIZE AND EXPAND LEFT THE COMPOSER BAR FOR A ROW OF THEIR OWN.
  //                    Part B put them in the control row and the measurement sent them out again:
  //                    at 360 that row had 106px for three text pills that wanted 150, so all three
  //                    were ellipsized, the shipped mode pill included. The owner ruled they sit in
  //                    a small row above the field instead, shown after each reply, sharing that
  //                    slot with the ask-about-the-selection bar, which wins; and the control row
  //                    went back byte for byte to the row of aa497d5. INDEX.HTML DID NOT MOVE this
  //                    round -- everything is in app.jsx -- so two of the three worker figures and
  //                    one of the two mirrors below were already true and only the BUNDLE figures
  //                    moved. app.js was rebuilt from that source 1399197 -> 1408320 (+9123) by
  //                    node tools/build-app.cjs, and CORE_BYTES was re-cut 2243889 -> 2253012
  //                    (+9123) by node tools/core-bytes.cjs --write, which is exactly the bundle
  //                    delta because the shell did not grow. The worker table at :111 and the
  //                    app.js mirror below followed, and THIS digest is re-cut LAST. CACHE IS NOT
  //                    BUMPED: this is a branch for the owner to try, not a ship, and sw.js says
  //                    the merge round owns the bump.
  //   2026-09-09   -- ITEM 05 F: THE COMPOSER BECAME A FIELD ROW OVER ONE CONTROL ROW. The
  //                    field has the top row to itself and send moved down into the control
  //                    row at the VISUAL RIGHT, with mic and the voice entry beside it and the
  //                    mode pill and the [+] at the other end; the three icon buttons became
  //                    44x44 circles and the chip became a pill. INDEX.HTML DID NOT MOVE this
  //                    round -- the change is all in app.jsx -- so two of the three worker
  //                    figures and one of the two mirrors below were already true and only the
  //                    BUNDLE figures moved. app.js was rebuilt from that source 1397224 ->
  //                    1399197 (+1973) by node tools/build-app.cjs, and CORE_BYTES was re-cut
  //                    2241916 -> 2243889 (+1973) by node tools/core-bytes.cjs --write, which
  //                    is exactly the bundle delta because the shell did not grow. The worker
  //                    table at :111 and the app.js mirror below followed, and THIS digest is
  //                    re-cut LAST. CACHE IS NOT BUMPED: this is a branch for the owner to try,
  //                    not a ship, and sw.js says the merge round owns the bump.
  //   2026-09-09   -- ITEM 05 E1/E2: the home tiles became the section NAME in a square --
  //                    the icon, the sub-line and the chevron left the rendered tile and
  //                    .ezist-mod/.ezist-feature took aspect-ratio:1/1 with the centring, so
  //                    the shell grew 123062 -> 124729 (+1667); and «wirdi al-yawm» stopped
  //                    being a card on the home and became a SECTION entered from a row that
  //                    draws the title alone, with the +, the -, the added rows, the choice
  //                    lines and the empty sentence all inside it. app.js was rebuilt from
  //                    that source 1391446 -> 1397224 (+5778) by node tools/build-app.cjs,
  //                    and CORE_BYTES was re-cut 2234471 -> 2241916 (+7445) by node
  //                    tools/core-bytes.cjs --write -- the bundle's +5778 plus the shell's
  //                    +1667, which is exactly that delta. The THREE worker figures (the
  //                    shell at :57, the shell and the bundle at :111) and the TWO mirrors
  //                    below followed, and THIS digest is re-cut LAST. CACHE IS NOT BUMPED:
  //                    this is a branch for the owner to try, not a ship, and sw.js says the
  //                    merge round owns the bump.
  //   2026-09-09   -- ITEM 05 A/C/D: three sections per row at EVERY width (index.html only, so
  //                    the shell grew 122811 -> 123062); �wirdi al-yawm� became a live list with
  //                    a + and a - over four sections, under its own key ezik_wird_list_v1; and
  //                    �arrange your home� moved out of the home into Settings, where it now
  //                    reorders the ten shelf sections under ezik_home_order_v1 as well as the
  //                    three widgets it always reordered. app.js was rebuilt from that source
  //                    1367950 -> 1391446 (+23484) by node tools/build-app.cjs, and CORE_BYTES
  //                    was re-cut 2210724 -> 2234471 (+23747) by node tools/core-bytes.cjs
  //                    --write -- the bundle's +23484 plus the shell's +251, which is exactly
  //                    that delta. The worker byte table and the THREE SW_PROSE figures above
  //                    (the shell at :57, the shell and the bundle at :111) all followed, and
  //                    THIS digest is re-cut last. CACHE IS NOT BUMPED: this is a branch for the
  //                    owner to try, not a ship, and sw.js says the merge round owns the bump.
  //   2026-09-09   -- ITEM 05, THE THREE-ACROSS SHELF AND THE CHAT RAIL'S HOME BUTTON. The shelf
  //                    goes three across from 1000px: index.html:614 is repeat(3,1fr) and the two
  //                    span rules that made six tracks read as three tiles are deleted, so every
  //                    tile holds exactly one track. .ezc-rail-inner gained a home button as its
  //                    LAST child, which under body{direction:rtl} is the visual left; it reuses
  //                    the declared key navigation.home and adds no CSS. The drawer's second door
  //                    to asmaa and a stale comment paragraph were deleted on the owner's ruling,
  //                    and the 1000px comment was re-cut to the ruling now in force. app.js was
  //                    rebuilt from that source 1368253 -> 1367950 (-303), index.html moved
  //                    122884 -> 122811 (-73) over the shelf edit and the comment, CORE_BYTES was
  //                    re-cut 2211100 -> 2210724 by tools/core-bytes.cjs --write, the index.html
  //                    and app.js figures in the byte table above CORE_BYTES and their SW_PROSE
  //                    mirrors below all followed, and THIS digest was cut last, after every one
  //                    of them. sw.js is 44695 bytes at CR = 0. CACHE is NOT touched -- the store
  //                    name is the merge round's.
  //   2026-09-09   -- ITEM 37 PIECE 2: the related-lessons search under a settled reply is now
  //                    built from the ANSWER's words instead of the reader's question. app.jsx
  //                    gained one pure builder (ezikLessonsQuery) and repointed one call site;
  //                    app.js was rebuilt from that source 1364887 -> 1368253 (+3366) by node
  //                    tools/build-app.cjs, and CORE_BYTES was re-cut 2207734 -> 2211100 by node
  //                    tools/core-bytes.cjs --write, which is exactly that delta. The worker byte
  //                    table and the SW_PROSE mirror above both followed, and THIS digest is
  //                    re-cut last. CACHE IS NOT BUMPED: this is a branch for the owner to try on
  //                    a preview, not a ship, and sw.js says the merge round owns the bump.
  //   2026-09-09   -- ITEM 26 SHIP: أسماء الله الحسنى takes the HEAD of the home shelf, the rules
  //                    page gains the owner's eighth rule, and the store name is bumped. app.jsx
  //                    moved one descriptor to the top of ezHomeModules and re-cut six dictionary
  //                    values («القواعد السبع» -> «القواعد الثماني»); app.js was rebuilt from that
  //                    source 1364046 -> 1364887 (+841) by node tools/build-app.cjs, and CORE_BYTES
  //                    was re-cut 2206893 -> 2207734 by node tools/core-bytes.cjs --write, which is
  //                    exactly that delta. The worker byte table and the SW_PROSE mirror below both
  //                    followed, and THIS digest is re-cut last. CACHE IS bumped here, ezik-v32 ->
  //                    ezik-v33, and SW_CACHE below with it: a reader holding the old bundle would
  //                    otherwise keep a shelf with no section at its head.
  //   2026-09-08   -- ITEM 104/105, THE MUSHAF READING PAGE. The owner's ruling of 8 Sept 2026:
  //                    the reading page carries the memorisation mark and the way back to the
  //                    suras and NOTHING else. app.jsx lost the bottom dock outright -- both
  //                    renderer shapes, the two arrows, the jump control and the height
  //                    measurement the wird strip used to be positioned against -- and the wird
  //                    strip and the page mark MOVED, unrewritten, to the mushaf index. Item 105
  //                    added mushafPageReady(), which waits for the opening page's own asset
  //                    before `state` turns 'ok', so the reader is never shown a page frame with
  //                    nothing in it. No new asset, no new origin, no new key. app.js was
  //                    rebuilt from that source 1338609 -> 1336026 (-2583), CORE_BYTES was
  //                    re-cut 2181456 -> 2178873 by tools/core-bytes.cjs --write, the app.js
  //                    figure in the byte table above CORE_BYTES and the SW_PROSE mirror below
  //                    both followed 1338609 -> 1336026, and THIS digest was cut last, after
  //                    all of them. CACHE is NOT touched -- the store name is the merge round's.
  // ITEM 20 SHELF, COMMIT THREE -- WHO SEES THE WOMEN'S CORNER (2026-09-08,
  //                    feat/shelf-20260908). NO CHANGE IN THE WORKER ITSELF BEYOND ITS BYTE
  //                    TABLE. D-10 is reversed: the form of address decides who is drawn that
  //                    section, \u00abmale\u00bb is not drawn it, and the switch that used to decide it is
  //                    deleted from Settings with its device key, its reader and its writer. The
  //                    key literal survives at exactly ONE line in app.jsx -- the removeItem in
  //                    \u00abdelete all my data\u00bb -- because an abandoned value is still one person's
  //                    record in one person's browser, and that page promises it goes; the roster
  //                    entry in tools/delete-truth-measure.cjs became a `lit` for the same reason.
  //                    app.js followed 1337339 -> 1338609 (+1270) and CORE_BYTES 2180186 ->
  //                    2181456 is exactly that delta. The worker byte table and the SW_PROSE
  //                    mirror below both followed, and THIS digest is re-cut last. CACHE is NOT
  //                    bumped: install rewrites every CORE entry into the same store.
  // ITEM 20 SHELF, COMMIT TWO -- THE ORDER (2026-09-08, feat/shelf-20260908). NO CHANGE IN THE
  //                    WORKER ITSELF BEYOND ITS BYTE TABLE. The women's corner moved from the
  //                    second position on the home shelf to the last one, after every other
  //                    section; the articles section stays first and the seven between them do
  //                    not move. One row of a literal array changed position and the comment
  //                    above it was rewritten, which is the whole of the bundle's growth.
  //                    app.js followed 1336450 -> 1337339 (+889) and CORE_BYTES 2179297 ->
  //                    2180186 is exactly that delta. The worker byte table and the SW_PROSE
  //                    mirror below both followed, and THIS digest is re-cut last. CACHE is NOT
  //                    bumped: install rewrites every CORE entry into the same store.
  // ITEM 20 SHELF, COMMIT ONE -- THE NAME (2026-09-08, feat/shelf-20260908). NO CHANGE IN THE
  //                    WORKER ITSELF BEYOND ITS BYTE TABLE. The articles section is called
  //                    «Ezik's articles» on the shelf, in its own screen head and in the writing
  //                    form's section chooser; the change is TWO dictionary values and nothing
  //                    else -- no key, no descriptor id, no section register and no stored value
  //                    moved, which is why the bundle grew by eight bytes. app.js followed
  //                    1336442 -> 1336450 (+8) and CORE_BYTES 2179289 -> 2179297 is exactly that
  //                    delta. The worker byte table and the SW_PROSE mirror below both followed,
  //                    and THIS digest is re-cut last. CACHE is NOT bumped: install rewrites
  //                    every CORE entry into the same store.
  // ITEM 8 -- THE BROWSER DOOR (2026-09-07, feat/night-run-20260907, phase 7). NO CHANGE IN THE
  //                    WORKER ITSELF BEYOND ITS BYTE TABLE. api/auth-return.js gained a second
  //                    destination for a flow that started in a tab, and the page gained the press,
  //                    the per-tab state and the return leg that walk it; app.js followed
  //                    1327772 -> 1336442 (+8670) and CORE_BYTES 2170619 -> 2179289 is
  //                    exactly that delta. The worker byte table and the SW_PROSE mirror below both
  //                    followed, and THIS digest is re-cut last. CACHE is NOT bumped: install
  //                    rewrites every CORE entry into the same store.
  // THE GRANT CHECK (2026-09-07, feat/night-run-20260907, phase 4). NO CHANGE IN THE WORKER
  //                    ITSELF BEYOND ITS BYTE TABLE. One control in Settings, drawn only where a
  //                    founder token is held, that presses the very door that refuses a writer and
  //                    says which of the four refusals it was; app.js followed 1321078 -> 1327772
  //                    (+6694) and CORE_BYTES 2163925 -> 2170619 is exactly that delta. The
  //                    worker byte table and the SW_PROSE mirror below both followed, and THIS
  //                    digest is re-cut last. CACHE is NOT bumped: install rewrites every CORE
  //                    entry into the same store.
  // ITEM 9 -- THE PROFILE BLOCK AND THE HIDE CONTROL (2026-09-07, feat/night-run-20260907,
  //                    phase 3). NO CHANGE IN THE WORKER ITSELF BEYOND ITS BYTE TABLE. A third
  //                    form of address that says "prefer not to say" out loud instead of being
  //                    reached by pressing a word twice, and one switch that hides the women
  //                    section from the shelf on this device and puts it back from the same
  //                    place; app.js followed 1315901 -> 1321078 (+5177) and CORE_BYTES
  //                    2158748 -> 2163925 is exactly that delta. The worker byte table and the
  //                    SW_PROSE mirror below both followed, and THIS digest is re-cut last.
  //                    CACHE is NOT bumped: install rewrites every CORE entry into the same store.
  // ITEM 7 -- THE MARK ON A SECTION HOLDING SOMETHING NEW (2026-09-07,
  //                    feat/night-run-20260907, phase 2). NO CHANGE IN THE WORKER ITSELF BEYOND
  //                    ITS BYTE TABLE. A device-local record of what each section has already
  //                    shown this reader, a dot on the two shelf tiles that hold something newer
  //                    than it, and two list requests made AFTER the first paint; app.js followed
  //                    1307875 -> 1315901 (+8026) and CORE_BYTES 2150722 -> 2158748 is exactly
  //                    that delta. The worker byte table and the SW_PROSE mirror below both
  //                    followed, and THIS digest is re-cut last. CACHE is NOT bumped: install
  //                    rewrites every CORE entry into the same store.
  // THE TWO UNREGISTERED BACK LAYERS (2026-09-07, feat/night-run-20260907, phase 1).
  //                    NO CHANGE IN THE WORKER ITSELF BEYOND ITS BYTE TABLE. The prayer sheet
  //                    and the arrange panel each register a back layer now, and each visible
  //                    way out of them spends the entry that registration pushes; app.js
  //                    followed 1306083 -> 1307875 (+1792) and CORE_BYTES 2148930 -> 2150722
  //                    is exactly that delta. The worker byte table and the SW_PROSE mirror
  //                    below both followed, and THIS digest is re-cut last. CACHE is NOT
  //                    bumped: install rewrites every CORE entry into the same store.
  // THE ARTICLES SCREENS (2026-09-07, feat/item20-ui-loop-20260907, item 20 stage two).
  //                    NO CHANGE IN THE WORKER ITSELF BEYOND ITS BYTE TABLE. The server half of
  //                    item 20 had been live since 2e33456 and no screen existed, so nobody could
  //                    see any of it; the two reader sections, the reading view and the writing
  //                    screen landed in app.jsx and app.js followed 1265332 -> 1306083 (+40751
  //                    across two commits: +40399 for the screens, +352 for a locked section
  //                    chooser that says it is locked), and CORE_BYTES 2108179 -> 2148930 is
  //                    exactly that delta. The worker byte
  //                    table and the SW_PROSE mirror below both followed, and THIS digest is
  //                    re-cut last. CACHE is NOT bumped: install rewrites every CORE entry into
  //                    the same store.
  // THE BOOK CARD OPENS ONTO ITS MATN (2026-09-01, feat/item7-library-freebrain-20260901,
  //                    piece 9 / degree 1). AGAIN NO CHANGE IN THE WORKER ITSELF BEYOND ITS BYTE
  //                    TABLE. The chip built by the round below named a book and a page and
  //                    could not show one word of what the answer rested on: the passage reached
  //                    the row (lib/free-brain/tools.js) and died at the tag, which read three
  //                    fields and not that one. It now rides on the SAME tag, base64 so that a
  //                    quotation full of guillemets cannot truncate the card, and a touch opens
  //                    it under the chip. app.js followed 1253566 -> 1259367 (+5801) and
  //                    CORE_BYTES 2096413 -> 2102214 is exactly that delta. The worker byte
  //                    table and the SW_PROSE mirror below both followed, and THIS digest is
  //                    re-cut last. CACHE is NOT bumped: install rewrites every CORE entry into
  //                    the same store.
  // THE LIBRARY BOOK CARD (2026-09-01, feat/item7-library-freebrain-20260901). ONE CHANGE IN THE
  //                    WORKER ITSELF BEYOND ITS BYTE TABLE: none. `lib_book` atoms reached the
  //                    answer and no card was ever built for them — the tool existed in one file,
  //                    the client knew nothing of it — so the server now builds a `<book>` chip
  //                    from the rows the delivered text cited and the client draws it. app.jsx
  //                    grew and app.js followed 1249879 -> 1253566 (+3687), and CORE_BYTES
  //                    2092726 -> 2096413 is exactly that delta. The worker byte table and the
  //                    SW_PROSE mirror below both followed, and THIS digest is re-cut last. CACHE
  //                    is NOT bumped: install rewrites every CORE entry into the same store.
  // APPLE 4.0.0 (2026-08-30, fix/apple-400-onboard-remove-20260830). ONE CHANGE IN app.jsx AND
  //                    NOT ONE IN THE WORKER ITSELF beyond its byte table: submission e931435e-
  //                    f171-4da4-b476-c33fd5dde452 was refused for asking a name and a year
  //                    after Sign in with Apple, so the step behind the entry card is gone and
  //                    the three fields it asked for moved into Settings. app.js followed
  //                    1242855 -> 1248701 (+5846), and CORE_BYTES 2085702 -> 2091548 is exactly
  //                    that delta. The worker byte table and the SW_PROSE mirror below both
  //                    followed, and THIS digest is re-cut last. CACHE is NOT bumped: install
  //                    rewrites every CORE entry into the same store.
  // THE WEB-SHELL SEAM (2026-08-28, feat/web-shell-seam-20260828). THREE CHANGES IN app.jsx AND
  //                    NOT ONE IN THE WORKER ITSELF beyond its byte table: a FIFTH shell channel
  //                    that hands this page a finished session (written through the existing
  //                    writeAuthSession, no new key), a shell-declared flag that takes both
  //                    provider doors off the entry screen while the guest door stays, and the
  //                    qibla panel re-arming the heading stream when the location permission it
  //                    needs is granted. app.js followed 1216884 -> 1232987 (+16103), and
  //                    CORE_BYTES 2059731 -> 2075834 is exactly that delta. The worker byte
  //                    table and the SW_PROSE mirror below both followed, and THIS digest is
  //                    re-cut last. CACHE is NOT bumped: install rewrites every CORE entry into
  //                    the same store.
  // LOGIN FIRST + THE GUEST DOOR (2026-08-27, feat/login-first-20260827). THE FIRST SCREEN A
  //                    DEVICE MEETS IS NOW THE ENTRY SCREEN: two provider doors and a guest door
  //                    beside them, with the wird/conversations warning drawn on it, and the name
  //                    and year moved BEHIND that answer and made optional. One new device key,
  //                    ezik_entry_v1, on the erase roster. No route, no screen and no cache name
  //                    moved -- Onboarding gained a step, it did not become two components.
  //                    app.jsx grew and app.js followed 1205975 -> 1216868 (+10893),
  //                    and CORE_BYTES 2048822 -> 2059715 is exactly that delta. The
  //                    worker byte table and SW_PROSE mirror below both followed, and THIS digest
  //                    is re-cut last. CACHE is NOT bumped: install rewrites every CORE entry
  //                    into the same store.
  // QIBLA CALIBRATION ARROW (2026-08-27, feat/qibla-heading-20260827). THE OWNER KEEPS THE
  //                    CALIBRATION STREAM MOVING, but its arrow now carries the judgment: it is
  //                    hollow and dashed, with a calibration-only marker, while ready/live keeps
  //                    the original solid path and no marker. No text, bearing, state branch,
  //                    key, cache name, or CORE entry moved. app.jsx grew and app.js followed
  //                    1205284 -> 1205975 (+691), and CORE_BYTES 2048131 -> 2048822 is exactly
  //                    that delta. The worker byte table and SW_PROSE mirror below both followed,
  //                    and THIS digest is re-cut last. CACHE is NOT bumped: install rewrites
  //                    every CORE entry into the same store.
  // QIBLA HEADING STREAM (2026-08-27, feat/qibla-heading-20260827). THE WEB ASKS WHILE THE PANEL
  //                    LIVES. The native bridge is detected by the existing detector, receives
  //                    one start and one stop, and supplies five statuses without the web
  //                    reclassifying accuracy. Without that bridge, the browser orientation path
  //                    is unchanged. app.jsx grew and app.js followed 1200987 -> 1205284 (+4297),
  //                    and CORE_BYTES 2043834 -> 2048131 is exactly that delta -- no CORE entry
  //                    was added or removed. The worker byte table and SW_PROSE mirror below both
  //                    followed, and THIS digest is re-cut last. CACHE is NOT bumped: install
  //                    rewrites every CORE entry into the same store.
  // PARENTAL GATE + CHILD AI CONSENT (2026-08-27, feat/parental-gate-20260827). THE CODE KEEPS
  //                    ITS PLACE AND GAINS TWO THINGS. D12 stands -- the parent code is judged on
  //                    the server and no device key holds it -- so the erratum that ordered it
  //                    onto the device was withdrawn and NOTHING here moved storage. What the
  //                    server record gained is an age (`setAt`, 365 days, judged in the endpoint
  //                    rather than by a store TTL so an expired code can be NAMED instead of
  //                    looking like a code that never existed) and a way out (`delete`, guarded
  //                    by the code itself under the same limiter as verify). On the client that
  //                    is ParentCodeCard on the parents' dashboard, behind an armed step, writing
  //                    nothing to the device. The AI-consent record gained the profile id it was
  //                    given for, so a second child on one tablet is asked in their own right --
  //                    same key, same delete roster entry, no new storage anywhere.
  //                    app.jsx grew and app.js followed 1193820 -> 1200987 (+7167), and
  //                    CORE_BYTES 2036667 -> 2043834 is exactly that delta -- no CORE entry was
  //                    added or removed this round. The byte table above the constant and its
  //                    SW_PROSE mirror below both followed, and THIS digest is re-cut last
  //                    because it seals the bytes every step above it moved. CACHE is NOT bumped:
  //                    install rewrites every CORE entry into the same store.
  // ITEMS 43-b / 47-b (2026-08-27, feat/reminder-settings-20260826). THE REMINDER SETTINGS.
  //                    A group inside the Settings screen carrying four independent reminders --
  //                    the morning adhkar door, the evening adhkar door, the daily wird and the
  //                    daily content -- each with a switch, a time the reader picks, and (for the
  //                    two where a count is right) up to three times a day. All four default OFF.
  //                    The feed joins the prayers through ezikSchedItems and every item carries a
  //                    route naming its destination; the shell fires them and a browser tab does
  //                    not, which the screen says to the reader in its own line.
  //                    app.jsx grew and app.js followed 1171036 -> 1193820 (+22784), and
  //                    CORE_BYTES 2013883 -> 2036667 is exactly that delta -- no CORE entry was
  //                    added or removed this round. The byte table above the constant and its
  //                    SW_PROSE mirror below both followed, and THIS digest is re-cut last
  //                    because it seals the bytes every step above it moved. CACHE is NOT bumped:
  //                    install rewrites every CORE entry into the same store.
  //   adhkar ship   -- the two doors go to every reader. FOUR things move and the digest is cut
  //                    after all of them. (1) PRECACHE: adhkar-split-27.json joins CORE beside
  //                    adhkar.json, so the doors survive a cold offline boot instead of falling
  //                    back to the undivided group; its revalidation needed no line, because the
  //                    fetch handler already moves every same-origin *.json but the two sealed
  //                    mushaf files to stale-while-revalidate. (2) The twins guard is WIDENED to
  //                    compare the split pair as well -- same checks, same order, no new gate,
  //                    roster still 99. (3) A favourite saved as 27:<position> is resolved
  //                    through the data to a dhikr id and lights that dhikr in its new door --
  //                    READ ONLY, nothing migrated or renamed. (4) The switch default is RAISED:
  //                    no parameter means the doors, and ?adhkargroups=0 is the rollback that
  //                    costs no deploy. app.jsx grew and app.js followed 1167264 -> 1171036
  //                    (+3772). CORE_BYTES 2002929 -> 2013883 = that delta plus the 7182 the new
  //                    CORE entry weighs. The byte table above the constant gained a term for it
  //                    and its SW_PROSE mirror gained the figure, so B14 can check it. CACHE is
  //                    NOT bumped and does not need to be: install rewrites every CORE entry
  //                    into the same store, which is measured, not assumed.
  //   adhkar split  -- category 27 opens as TWO doors instead of one. The owner's own file,
  //                    adhkar-split-27.json, assigns the twenty-four adhkar of the morning and
  //                    evening group to a morning door of 23 and an evening door of 21, and
  //                    carries its own wording for the six that are said differently after
  //                    noon. adhkar.json is NOT edited -- it is byte-identical, and repeat,
  //                    audio and id still come from its rows by id. The client fetches the
  //                    split from a byte copy at the root, made with fs.copyFileSync; that
  //                    file is NOT in CORE, so it is not precached and every failure to load
  //                    it falls back to the unsplit screen. app.jsx grew and app.js followed
  //                    1160295 -> 1167264 (+6969). app.js is in CORE, so three numbers moved
  //                    with it and all three are re-cut in the SAME commit as this digest:
  //                    CORE_BYTES 1995960 -> 2002929 by tools/core-bytes.cjs --write, the
  //                    app.js figure in the byte table above that constant, and its SW_PROSE
  //                    mirror below. THIS digest was cut LAST, after both sw.js edits. The
  //                    worker itself did not change: one integer and one figure in prose.
  //                    CACHE is NOT touched -- this branch is a preview and ships nothing.
  //   adhkar groups -- the adhkar reader gained a group standing line, a remembered position, a
  //                    bead card that spends one repetition per tap, and a first door chosen by
  //                    the clock -- all behind ?adhkargroups=1 and all OFF by default. app.jsx
  //                    grew and the app.js it builds followed 1147830 -> 1160295 (+12465).
  //                    app.js is in CORE, so three numbers moved with it and all three are
  //                    re-cut in the SAME commit as this digest: CORE_BYTES 1983495 -> 1995960
  //                    by tools/core-bytes.cjs --write, the app.js figure in the byte table
  //                    above that constant, and its SW_PROSE mirror below. THIS digest was cut
  //                    LAST, after both sw.js edits. The worker own behaviour did not change:
  //                    what moved inside sw.js is one integer and one figure in prose. CACHE is
  //                    NOT touched -- the store name is a ship decision the merge round owns,
  //                    and this branch is a preview that ships nothing.
  //   2026-08-26   -- THE DOOR OUT: deleting the account from inside the app, which Apple
  //                    requires of anything that creates one and which the sign-in round
  //                    shipped without. api/auth-delete.js is new and is the ONLY caller of
  //                    lib/auth/account.js deleteAccount(), which performs THREE erasures in a
  //                    fixed order: the verified-email index FIRST -- and only when the entry
  //                    names this very account, because the index is written NX and may still
  //                    name a different, living one -- then the account record, then the
  //                    session through revokeSession(), which had been loaded since sign-in
  //                    landed with no caller. The index goes first so a failure there leaves
  //                    the record standing and the address still derivable for a retry. The
  //                    account is known from the SESSION ALONE: no provider, no subject and no
  //                    address is read from the body, so the route cannot be aimed at anyone
  //                    else's account. A dead session, an expired one, an unreadable store and
  //                    an account already gone all answer 401 with the SAME code, so nothing
  //                    here is an oracle for whether an account exists. ZERO new store keys and
  //                    ZERO new environment variables; `pc:` is neither read nor written.
  //                    app.jsx gained the two-press control inside EzikSignInRow, drawn only
  //                    where a live session already is, and twelve dictionary entries. app.js
  //                    was rebuilt from that source 1143467 -> 1147830 (+4363), CORE_BYTES was
  //                    re-cut 1979132 -> 1983495 by tools/core-bytes.cjs --write, the app.js
  //                    figure in the byte table above CORE_BYTES and the SW_PROSE mirror below
  //                    both followed 1143467 -> 1147830, and THIS digest was cut last, after
  //                    all of them. sw.js is 44266 bytes before and after: only two numbers in
  //                    it moved. CACHE is NOT touched -- the store name is the merge round's.
  //   2026-08-26   -- THE SIGN-IN BRIDGE: the web half of the shell's auth handshake. app.jsx
  //                    gained ONE place that builds a sign-in request and ONE that posts it --
  //                    four fields, `v` the STRING "1" and never the number, and a `url` that is
  //                    always OUR /api/auth-start on ezik.app because the shell refuses to open
  //                    anything else. The contract's five refusal reasons are sorted into THREE
  //                    treatments -- a dismissal is silence and no red line, a message the shell
  //                    judged malformed is a programming fault that is never retried on its own,
  //                    and a device that could not open the sheet waits for the reader's own
  //                    gesture -- and a SIXTH reason nobody has heard of takes the last of those.
  //                    There is NO DEADLINE on the path, deliberately and provably: closing the
  //                    sheet IS the answer, so a timer would fire while a reader was still typing
  //                    a password and release the button under them. A client state is minted per
  //                    press with crypto.getRandomValues, kept in memory and NEVER stored, and a
  //                    return that does not carry it back is refused before its ticket is read.
  //                    The row draws ZERO nodes outside the shell. ONE key is stored -- the
  //                    session -- and resetAll erases it, so delete.html's promise that exactly
  //                    one thing remains stays true without a letter of that page being edited.
  //                    app.js was rebuilt from that source 1126907 -> 1143467 (+16560), CORE_BYTES
  //                    was re-cut 1962572 -> 1979132 by tools/core-bytes.cjs --write, the app.js
  //                    figure in the byte table above CORE_BYTES and the SW_PROSE mirror below
  //                    both followed 1126907 -> 1143467, and THIS digest was cut last, after all
  //                    of them. sw.js is 44266 bytes before and after: only two numbers in it
  //                    moved. CACHE is NOT touched -- the store name is the merge round's.
  //   2026-08-25   -- THE SAVE PIPE: the web half of the shell's download handler. app.jsx gained
  //                    ONE place that builds a download request and ONE that posts it -- seven
  //                    fields, `v` the STRING "1" and never the number, `b64` standard-alphabet
  //                    with the data: prefix cut through the comma and no whitespace in it, and
  //                    `size` the RAW byte count re-derived from the very characters sent rather
  //                    than guessed. The four-mebibyte limit is mirrored on this side so an
  //                    oversized file is never carried across to be handed back. There is NO
  //                    DEADLINE on the path, deliberately and provably: the shell answers only
  //                    after the reader closes the platform share sheet, which can take minutes,
  //                    so a timer that failed the request would be a lie about a save still open.
  //                    Without the bridge both presses are byte-identical to what they were: the
  //                    same anchor, the same download name, the same blob, zero messages and zero
  //                    new lines drawn. Six dictionary keys in both languages carry the shell's
  //                    five reasons and a general sixth, so no contract word reaches a screen.
  //                    app.js was rebuilt from that source 1111212 -> 1126907 (+15695), and app.js
  //                    IS in CORE, so the ritual ran in this commit and in this order: `npm run
  //                    build:app` regenerated the bundle, `node tools/core-bytes.cjs --write`
  //                    re-cut CORE_BYTES 1946877 -> 1962572, the app.js figure in the byte table
  //                    above that constant and its SW_PROSE mirror below both followed 1111212 ->
  //                    1126907, and THIS digest was cut last, after all of them. sw.js is 44266
  //                    bytes before and after, CR = 0: both figures kept their digit count and
  //                    only their values moved. CACHE is NOT touched: the store name stays
  //                    ezik-v32, because lifting it is a ship decision and not a work step.
  //                    tools/save-bridge-measure.cjs is the new proof -- 34 cases and six mutants,
  //                    every one of them killed. Three of those cases RENDER both seats through a
  //                    small React and count NODES, because "nothing changed in the browser" is a
  //                    claim about a tree and a claim about a tree is not proved by one about a press.
  //   2026-08-25   -- item 67, the second half: the READER'S SWITCH, and the path from the press
  //                    to the first scheduled reminder. app.jsx gained one storage key
  //                    (ezik_prayer_notify_v1), default OFF and off by construction rather than by
  //                    a value written at first run -- exactly one string means on and every other
  //                    reading of that slot, including a storage that throws, is off. ezikSchedItems
  //                    is gated on it, so a reader who has not asked builds nothing and the pipe
  //                    stays silent through all nine of its triggers. The switch is drawn inside the
  //                    prayer times panel and ONLY inside the shell: no bridge, no control, because a
  //                    stored preference no engine will read is a promise with nothing behind it. The
  //                    `enable` operation -- the one thing in the contract that can raise a system
  //                    prompt -- has a single call site, inside the press, outside every effect; a
  //                    refusal returns the switch to off in the store and on the screen with one
  //                    quiet line and no automatic retry; turning it off sends `cancel` once and
  //                    moves the pipe's fingerprint with it, so no later trigger posts an empty
  //                    rebuild dressed as a schedule. Seven dictionary keys in both languages.
  //                    app.js was rebuilt from that source 1100763 -> 1111212 (+10449), and app.js IS
  //                    in CORE, so the ritual ran in this commit and in this order: `npm run
  //                    build:app` regenerated the bundle, `node tools/core-bytes.cjs --write` re-cut
  //                    CORE_BYTES 1936428 -> 1946877, the app.js figure in the byte table above that
  //                    constant and its SW_PROSE mirror below both followed 1100763 -> 1111212, and
  //                    THIS digest was cut last, after all of them. sw.js is 44266 bytes before and
  //                    after, CR = 0: both figures kept their digit count and only their values
  //                    moved. CACHE is NOT touched: the store name stays ezik-v32, because lifting
  //                    it is a ship decision and not a work step. tools/wird-guard.cjs (gate 107) is
  //                    NOT touched either -- the switch is named and worded to clear its ban rather
  //                    than the ban widened to clear the switch, and the component is declared
  //                    OUTSIDE the panel slice that gate scans for timers and permissions.
  //                    tools/schedule-payload-measure.cjs grew from 37 cases to 51: it now compiles
  //                    the lifted block through @babel/core and renders the switch against a small
  //                    React, so what is drawn is measured and not asserted. Five mutants were run
  //                    against it -- enable sent from an effect, a refusal leaving the switch on, an
  //                    off that cancels nothing, a gate removed, and the switch drawn without a
  //                    shell -- and all five went red; app.jsx came back byte for byte after each.
  //   2026-08-25   -- item 67, the call at its time: the ONE feed that had an anchor rides the
  //                    pipe the commit before this one built. app.jsx gained ezikAdhanItems():
  //                    the five prayers of the next seven local days, taken from prayerTimesFor()
  //                    -- the one calculator already in this file -- and converted from MINUTES
  //                    FROM LOCAL MIDNIGHT into absolute epoch milliseconds by rebuilding the
  //                    local WALL CLOCK of each day, so a day across a daylight change lands on
  //                    the clock the reader reads. It calls no builder that STORES: arming must
  //                    not create a store for a reader who never opened the prayer sheet, and
  //                    that is measured by counting writes through a fake, not asserted. One
  //                    dictionary key in both languages ('prayer.due'); the sunrise is filtered
  //                    out by name because it is not a prayer. app.js was rebuilt from that
  //                    source 1095406 -> 1100763 (+5357), and app.js IS in CORE, so the ritual
  //                    ran in this commit and in this order: `npm run build:app` regenerated the
  //                    bundle, `node tools/core-bytes.cjs --write` re-cut CORE_BYTES 1931071 ->
  //                    1936428, the app.js figure in the byte table above that constant and its
  //                    SW_PROSE mirror below both followed 1095406 -> 1100763, and THIS digest
  //                    was cut last, after all of them. sw.js is 44266 bytes before and after,
  //                    CR = 0. CACHE is NOT touched: the store name stays ezik-v32, because
  //                    lifting it is a ship decision and not a work step. tools/wird-guard.cjs
  //                    (gate 107) was NARROWED in the same commit -- its whole-file ban on the
  //                    latin type name became an exact allowance of one declaration plus two new
  //                    checks it never had, so its assertion count went UP 1122 -> 1124.
  //   2026-08-25   -- the schedule pipe, the web half. app.jsx gained the web end of the shell's
  //                    notification contract: one place that builds a schedule message with
  //                    ABSOLUTE epoch-millisecond timestamps, drops anything already past, sends
  //                    nothing at all when window.ReactNativeWebView is absent, and never sends
  //                    the same payload twice. NOTHING RIDES IT YET -- the feed returns an empty
  //                    list, so the pipe is silent in a shell as well as in a tab. app.js was
  //                    rebuilt from that source 1082779 -> 1095406 (+12627), and app.js IS in
  //                    CORE, so the ritual ran in this commit and in this order: `npm run
  //                    build:app` regenerated the bundle, `node tools/core-bytes.cjs --write`
  //                    re-cut CORE_BYTES 1918444 -> 1931071, the app.js figure in the byte table
  //                    above that constant and its SW_PROSE mirror below both followed 1082779
  //                    -> 1095406, and THIS digest was cut last, after all of them. sw.js is
  //                    44266 bytes before and after, CR = 0: every figure kept its digit count
  //                    and only its value moved. CACHE is NOT touched: the store name stays
  //                    ezik-v32, because lifting it is a ship decision and not a work step.
  //                    tools/schedule-payload-measure.cjs is added in the same commit and lifts
  //                    the pipe out of app.jsx with @babel/parser to hold it to all of the above.
  //   2026-08-25   -- the store lift for the delete-page truth round. CACHE ezik-v31 ->
  //                    ezik-v32. MEASURED FIRST, because the bump is only justified if a
  //                    returning reader is actually being served the old bytes, and the file
  //                    that forces it IS in CORE: app.js, which the commit below rebuilt
  //                    1081237 -> 1082779 when resetAll gained the four erasures delete.html
  //                    had already promised. sw.js was driven in a vm with a stub CacheStorage
  //                    recording every match, put, add and delete, and a fetch that COUNTS its
  //                    calls: install add()s 10 CORE entries into the store and '/app.js' is
  //                    one of them, and a GET of it on a WORKING network is then answered out
  //                    of the store with ZERO network calls -- same-origin static assets match
  //                    no earlier branch and land in the generic cache-first arm (sw.js:741),
  //                    which returns the hit and never revalidates. So a returning reader keeps
  //                    the OLD bundle -- and with it the OLD resetAll, the one that did not keep
  //                    the page's promise -- for as long as the store keeps its name, not merely
  //                    while offline. With CACHE lifted, activate's sweep (sw.js:434) deletes
  //                    exactly ezik-v31 and spares ezik-mushaf-pages-v1, and install repopulates
  //                    with the new bundle. THE CONTROL WAS RUN TOO: without the lift, activate
  //                    deletes nothing and the old bundle is still served on a live network.
  //                    The bump is the thing that drops it. NOTHING ELSE MOVED -- CORE_BYTES
  //                    stays 1918444 (sw.js is not in CORE and no CORE file's size changed in
  //                    THIS commit; app.js was rebuilt in the commit below and CORE_BYTES was
  //                    re-cut there, with it; re-measured by tools/core-bytes.cjs: MATCH), and
  //                    no byte-table or SW_PROSE figure moved, since 'ezik-v31' and 'ezik-v32'
  //                    are both eight characters and sw.js did not change length: 44266 bytes
  //                    before and after, CR = 0, as the note above requires. MUSHAF_CACHE stays
  //                    ezik-mushaf-pages-v1, unversioned by design (item 33), and measured
  //                    above to survive the sweep. SW_CACHE below is re-cut in the SAME commit
  //                    as this digest -- it is the only mirror, re-checked by grep across the
  //                    tree -- and the digest AFTER both. app.js / app.jsx untouched here.
  //   2026-08-25   -- the delete-page truth round. app.jsx gained FOUR localStorage removals in
  //                    resetAll -- the AI-consent record, the saved qibla position, the prayer
  //                    preferences and the schedule derived from them -- because delete.html has
  //                    promised all four in both languages since it shipped and the code kept
  //                    only some of them. The PAGE was not touched: the promise was already the
  //                    right one, so the code moved to it. app.js was rebuilt from that source
  //                    1081237 -> 1082779 (+1542), and app.js IS in CORE, so three things moved
  //                    in this commit and in this order: `npm run build:app` regenerated the
  //                    bundle, `node tools/core-bytes.cjs --write` re-cut CORE_BYTES 1916902 ->
  //                    1918444, the app.js figure in the byte table above that constant and its
  //                    SW_PROSE mirror below both followed 1081237 -> 1082779, and THIS digest
  //                    was cut last, after all of them. sw.js did not change LENGTH -- 44266
  //                    bytes before and after, CR = 0 -- because both figures kept their digit
  //                    count; only their values moved. CACHE is NOT touched here: the store name
  //                    is a ship decision and it gets its own commit, ezik-v31 -> ezik-v32,
  //                    directly after this one. tools/delete-truth-measure.cjs is added in the
  //                    same commit and holds the four removals, the twenty that already
  //                    happened, and the three keys the page promises SURVIVE.
  //   2026-08-25   -- the store lift for the location round. CACHE ezik-v30 -> ezik-v31, and
  //                    unlike round 29 below the file that forced it IS in CORE: app.js, which
  //                    the location commit rebuilt 1076271 -> 1081237. So this bump is not about
  //                    a page the fetch handler happens to store -- it is about the shipped
  //                    bundle itself, and the reason is MEASURED rather than assumed. sw.js was
  //                    driven in a vm with a stub CacheStorage recording every match, put, add
  //                    and delete: install add()s '/app.js' into CACHE as one of the ten CORE
  //                    entries, and a GET of it on a WORKING network is then answered out of the
  //                    store with ZERO network calls, because same-origin static assets land in
  //                    the generic cache-first arm (sw.js:741) which returns the hit and never
  //                    revalidates. A returning reader therefore keeps the OLD bundle for as
  //                    long as the store keeps its name -- not merely while offline, which is
  //                    the weaker claim round 29 could make about a network-first page. With
  //                    CACHE lifted, activate's sweep (sw.js:434) deletes exactly ezik-v30 and
  //                    spares ezik-mushaf-pages-v1, and install repopulates with the new bundle.
  //                    The control was run too: without the lift, activate deletes nothing and
  //                    the old bundle is still served on a live network. NOTHING ELSE MOVED --
  //                    CORE_BYTES stays 1916902 (sw.js is not in CORE and no CORE file's size
  //                    changed in this commit; re-measured by tools/core-bytes.cjs: MATCH), and
  //                    no byte-table or SW_PROSE figure moved, since 'ezik-v30' and 'ezik-v31'
  //                    are both eight characters and sw.js did not change length. MUSHAF_CACHE
  //                    stays ezik-mushaf-pages-v1, unversioned by design (item 33). SW_CACHE
  //                    below is re-cut in the SAME commit as this digest, and the digest AFTER
  //                    both.
  //   location web   -- the qibla button gained a second source behind it (the native shell's
  //                    bridge, when the page is inside the shell), so app.jsx grew and the app.js
  //                    it builds followed 1076271 -> 1081237 (+4966). app.js is in CORE, so three
  //                    numbers moved with it and all three are re-cut in the SAME commit as this
  //                    digest: CORE_BYTES 1911936 -> 1916902 by `node tools/core-bytes.cjs
  //                    --write`, the byte table above that constant, and SW_PROSE below. The
  //                    worker's own behaviour did not change -- what changed inside sw.js is one
  //                    integer and the prose around it, and that prose was ALSO corrected: it
  //                    still described the pre-item-112 rule under which CORE_BYTES was allowed
  //                    to trail the disk and B12 failed downward only. CACHE is NOT touched: the
  //                    store name is a ship decision and the merge round owns the bump.
  //   2026-08-25   -- merge round 29: the privacy-truth correction. privacy.html and delete.html
  //                    were the only files merged, and NEITHER is in CORE -- so CORE_BYTES did
  //                    NOT move (1911936, re-measured by tools/core-bytes.cjs and MATCH) and no
  //                    byte table or SW_PROSE figure moved with it. CACHE moved ezik-v29 ->
  //                    ezik-v30 all the same, and the reason is MEASURED rather than assumed:
  //                    the fetch handler was driven in a vm with a stub CacheStorage, and both
  //                    pages are written into CACHE by the network-first arm on every successful
  //                    navigation even though neither is precached -- so a reader with a dead
  //                    network is served the OLD legal text out of the old store, and a
  //                    non-navigate GET of either path falls through to the generic cache-first
  //                    arm and is served the old text with a working network and no
  //                    revalidation. activate() sweeps every store but CACHE and MUSHAF_CACHE,
  //                    so the bump is what actually drops those copies. SW_CACHE below is
  //                    re-cut in the SAME commit as this digest, and the digest AFTER both.
  //   2026-08-24   -- merge round 28: the khatmah tracker and the 36-B prose correction. A
  //                    completion of the whole book is now credited ONLY by a control the reader
  //                    presses -- the eight-second dwell timer that credits the daily wird reaches
  //                    it from nowhere -- and the length of the book is read off mushaf-layout.json
  //                    rather than written down a second time. BOTH core numbers moved this round:
  //                    app.js 1035264 -> 1060060 (+24796) and index.html 122568 -> 122884 (+316),
  //                    and CORE_BYTES followed 1870613 -> 1895725 (+25112) = the two deltas summed,
  //                    re-cut from the disk by tools/core-bytes.cjs --write. CACHE moved v26 ->
  //                    ezik-v27: the shell and the bundle are both in CORE and both changed.
  //                    NOTE FOR THE NEXT ROUND, measured here: the index.html figure is stated
  //                    TWICE in sw.js prose -- once in the byte table and once in the note on why
  //                    '/index.html' is not a CORE entry. Both had to move. Moving only the table
  //                    leaves the old integer standing in the other sentence, where B14's
  //                    completeness scan meets it as an UNREGISTERED number and fails on it, so a
  //                    one-line repair turns into a second red for no reason.
  //   2026-08-24   -- merge round 27: item 42-C, the share card's own attribution. The card was
  //                    handed serializeReply's TEXT and a footer string, and the source paragraph
  //                    and the notice are the LAST two things that text carries -- so a fixed line
  //                    budget cut them off first and the card went out with a bare domain where
  //                    its source belonged. The tail is reserved BEFORE the body is measured now,
  //                    the height became a floor of 1350 with a ceiling of 2700 instead of a
  //                    size, and the two paragraphs are MOVED out of the body rather than drawn
  //                    twice. It all lives in app.jsx, and index.html was NOT touched this round,
  //                    so ONE core number moved: app.js 1026796 -> 1035264 (+8468), and
  //                    CORE_BYTES followed 1862145 -> 1870613 (+8468), re-cut from the disk by
  //                    tools/core-bytes.cjs --write. CACHE moved v25 -> v26: the bundle a
  //                    returning reader boots is precached in CORE and it changed. The index.html
  //                    figure in the byte table is UNCHANGED and was left alone -- only the app.js
  //                    one moved, with its SW_PROSE mirror, in THIS commit, and the seal below
  //                    AFTER both.
  //   2026-08-24   -- merge round 26: item 42, both halves. The share CARD had its bidi fixed
  //                    (its canvas resolved direction to LTR, so every sentence-final mark was
  //                    drawn at the START of an Arabic line) and its line budget derived from
  //                    the card's own geometry instead of a hand-picked 13; the EXPORT stopped
  //                    calling a CDN rasteriser and became window.print(). Both live in app.jsx,
  //                    and the export also took six lines of print stylesheet, so BOTH CORE
  //                    numbers moved: app.js 1019495 -> 1026796 (+7301), index.html 121979 ->
  //                    122568 (+589), and CORE_BYTES followed 1854255 -> 1862145 (+7890), re-cut
  //                    from the disk by tools/core-bytes.cjs --write. CACHE moved v24 -> v25:
  //                    the shell and the bundle are both in CORE and both changed.
  //                    AND THIS ROUND ALSO REPAIRED sw.js's OWN PROSE, which the round that
  //                    caused the drift was forbidden to touch: two present-tense notes said a
  //                    PDF bundle is fetched from cdnjs on the first export, and it is not
  //                    fetched at all any more. A third mention survives on purpose -- it sits
  //                    inside a quotation of what that note read before item 32, and correcting
  //                    a quotation would make the record false rather than true.
  //                    SW_CACHE, the TWO SW_PROSE mirrors and the byte table above sw.js
  //                    CORE_BYTES were re-cut in THIS commit, and the seal below AFTER all of
  //                    them.
  //   2026-08-24   -- merge round 25: two branches with no path in common between them. The
  //                    home screen took a widget register with one stored arrangement, an
  //                    arranging mode, and the prayer-times, adhkar and daily-verse widgets;
  //                    the web presence took a static about page, a sitemap, a robots file and
  //                    a canonical on every static page. The two halves land on OPPOSITE sides
  //                    of the shell, so both CORE numbers moved this round and not one:
  //                    app.js 990041 -> 1019495 (+29454) from the widget branch, index.html
  //                    120617 -> 121979 (+1362) from the web-presence branch, and CORE_BYTES
  //                    followed 1823439 -> 1854255 (+30816), re-cut from the disk by
  //                    tools/core-bytes.cjs --write. CACHE moved v23 -> v24: the shell
  //                    AND the bundle a returning reader boots are both in CORE and both
  //                    changed, so the store name must move or they are served the old bytes
  //                    of both. SW_CACHE, the TWO SW_PROSE mirrors and the byte table above
  //                    sw.js CORE_BYTES were re-cut in THIS commit, and the seal below AFTER
  //                    all of them.
  //   2026-08-23   -- the CC cleanup round, item B: the lessons section became the FOURTH way
  //                    out of an empty chat, appended to sectionSuggestions, and 5B-1 of the
  //                    lessons guard stopped COUNTING the two lessons routes and started
  //                    ACCOUNTING for them by name. The entry lives in app.jsx, so app.js grew
  //                    989660 -> 990041 (+381) under a shell that did not move, and CORE_BYTES
  //                    followed 1823058 -> 1823439, re-cut from the disk by
  //                    tools/core-bytes.cjs --write. CACHE is NOT touched: it moved ezik-v22 ->
  //                    v23 in the round above and nothing has shipped under v23 -- it is
  //                    absent from origin/main, measured this round -- so raising it twice
  //                    would burn a store name for a single ship. The SW_PROSE mirror and the
  //                    byte table above sw.js CORE_BYTES were re-cut in THIS commit, and the
  //                    seal below AFTER all of them.
  //   2026-08-23   -- the CC cleanup round: a comment above sectionSuggestions that denied the
  //                    lessons section, and ezLangRelabel deleting the prayer and library
  //                    descriptions on every language switch. Both live in app.jsx, so app.js
  //                    grew 989166 -> 989660 (+494) under a shell that did not move, and
  //                    CORE_BYTES followed 1822564 -> 1823058, re-cut from the disk by
  //                    tools/core-bytes.cjs --write. CACHE moved ezik-v22 -> v23 for the
  //                    reason every round below gives: the bundle a returning reader boots is
  //                    precached in CORE, so the store name must move or they keep the old
  //                    bytes. SW_CACHE, the SW_PROSE mirror and the byte table above sw.js
  //                    CORE_BYTES were re-cut in THIS commit, and the seal below AFTER all of
  //                    them.
  //   2026-08-23   -- item 24-C gave the lessons section a BROWSE tab beside its search: a
  //                    scholar, then a series, then the lessons under it. Browsing is a second
  //                    TAB, not a second screen, so index.html did not move -- but app.js grew
  //                    968689 -> 989166 (+20477) under it, and CORE_BYTES followed
  //                    1802087 -> 1822564, re-cut from the disk by tools/core-bytes.cjs --write.
  //                    CACHE moved v21 -> ezik-v22 for the reason the two rounds below give:
  //                    index.html is in CORE and the bundle under it changed, so a returning
  //                    reader must stop being served the old shell out of the old store.
  //                    SW_CACHE, the SW_PROSE mirror and the byte table above sw.js CORE_BYTES
  //                    were re-cut in THIS commit, and the seal below AFTER all of them.
  //   2026-08-23   -- items 24-A and 24-B put the lessons route in the interface: first the tail
  //                    card under a settled reply, then the section of its own. app.js grew
  //                    947845 -> 955775 -> 968689 across the two merge rounds, so CORE_BYTES and
  //                    the byte table above it were re-cut from the disk both times, by
  //                    tools/core-bytes.cjs --write. CACHE moved ezik-v19 -> v20 -> v21: index.html
  //                    is in CORE and the bundle under it changed, so a returning reader must stop
  //                    being served the old shell out of the old store. SW_CACHE and the SW_PROSE
  //                    mirror were re-cut in the SAME commit each time. This line is the one the
  //                    24-A merge round owed and did not write: its order allowed the four values
  //                    and the seal only, so the seal moved with no word here saying why.
  //   item 33      -- the 604 printed page scans left the generic cache-first arm for a store of
  //                    their OWN, 'ezik-mushaf-pages-v1', which carries no version and which
  //                    activate's sweep now exempts BY NAME -- so a ship no longer throws away
  //                    tens of megabytes of files that cannot change. The arm is capped at
  //                    SW_MUSHAF_CAP pages with least-recently-used eviction and an estimate
  //                    before every write. B15 below and SW_MUSHAF_CACHE were cut in the SAME
  //                    commit as this digest. CACHE is NOT touched: the store name is the merge
  //                    round's to bump, and this item adds a SECOND store rather than bumping it.
  //   item 115-ب  -- the two TRANSFER sizes in the worker prose (298686 for the shell, 338409 and
  //                    151653 for the mushaf pair) were numbers nothing in this tree could ever
  //                    check -- they depend on the CDN encoder -- and had already gone stale. They
  //                    are restated on disk. B14 below, cut in the SAME commit as this digest, now
  //                    re-measures every size the prose states and refuses any integer of 500 or
  //                    more that is registered nowhere. CACHE is NOT touched.
  //   item 89-b    -- icon-watermark.png was re-packed LOSSLESSLY (373806 -> 368386 bytes; the
  //                    decoded pixels are byte-identical, alpha included, on two independent
  //                    decoders). The CORE_BYTES the worker declares fell with it, 1662972 ->
  //                    1657552, written by `node tools/core-bytes.cjs --write`, and the comment
  //                    table above that constant carries the same measurement. All three were
  //                    re-cut in the SAME commit. CACHE is NOT touched: the store name is the
  //                    merge round’s to bump.
  //   item 93-b    -- install ends by PUSHING its precache brief to every connected client
  //                    instead of leaving the record behind a request nobody makes. B13 below
  //                    was cut in the SAME commit as this digest. CACHE is NOT touched: the
  //                    store name is a ship decision and the merge round owns the bump.
  //   item 91-A     -- storage-quota management: an estimate before the first write, one
  //                    persist() request, a reason on every recorded failure, and an eviction
  //                    rule that drops OLD stores (never the current one) and retries once.
  //                    B12 below was cut in the SAME commit as this digest.
  //   item 22+104  -- CACHE 'ezik-v6' -> 'ezik-v7'. index.html is in CORE and item 22+104
  //                    changed it (the wird strip now leaves the DOM with the chrome), so a
  //                    returning reader must stop being served the old shell out of the old
  //                    store. SW_CACHE below is re-cut in the SAME commit as this digest.
  //   item 93      -- a failed precache entry is counted and named instead of swallowed. B11
  //                    gained the three item 93 checks in the SAME commit as this digest.
  //   item 90      -- the two sealed mushaf files left the stale-while-revalidate class and
  //                    returned to cache-first. B11 gained the ZERO-fetch half in the SAME commit.
  //   items 88 + 80 -- CACHE 'ezik-v1' -> 'ezik-v2' (so a returning reader stops being
  //                    served the old build out of the old store), and the same-origin
  //                    *.json class moved from cache-first to stale-while-revalidate.
  //                    SW_CACHE below and B11 were cut in the SAME commit as this digest.
  //   watermark     -- CORE gained '/icon-watermark.png' in the commit that pointed .ezwm at it.
  //   item 93      -- THE TASBIH. CORE itself did not change -- no file was added to it and none
  //                    removed -- but app.js IS in CORE and the bundle grew with the section, the
  //                    log and the card row, so the worker's byte table and CORE_BYTES both moved
  //                    and this digest is re-cut after them. CORE_BYTES was re-cut by
  //                    node tools/core-bytes.cjs --write, never by hand.
  //   item 95      -- THE SHARIAH CALCULATOR. Nine client-side calculators on a new home card.
  //                    CORE itself did not change -- no file entered it and none left -- but
  //                    app.js IS in CORE and the bundle grew with the module, the dictionary
  //                    keys and the style block: 1454895 -> 1499541 (+44646) under an
  //                    index.html that did not move at all. So CORE_BYTES followed
  //                    2440723 -> 2485369, re-cut from the disk by
  //                    node tools/core-bytes.cjs --write and never by hand, and the byte
  //                    table above that constant carries the same measurement. Both sw.js
  //                    edits and the SW_PROSE mirror were made first; this digest was cut
  //                    LAST, after all of them, on a tree measured at CR = 0. CACHE is NOT
  //                    touched: the store name is a ship decision and the merge round owns
  //                    the bump, and nothing in this item is deployed.
  //   item 96      -- THE DAILY GOLD PRICE IN THE CALCULATOR. CORE itself did not change -- no
  //                    file entered it and none left -- but app.js IS in CORE, and the bundle
  //                    grew with the new item 96 module, the karat picker, the two lines under
  //                    the gold price field and fourteen dictionary keys: 1499541 -> 1512566
  //                    (+13025) under an index.html that did not move at all. So CORE_BYTES
  //                    followed 2485369 -> 2498394, re-cut from the disk by
  //                    node tools/core-bytes.cjs --write and never by hand, and the byte table
  //                    above that constant carries the same measurement. Both sw.js edits and
  //                    the figure in the table at :2061 were made first; this digest was cut
  //                    LAST, after all of them, on a tree measured at CR = 0. CACHE is NOT
  //                    touched: the store name is a ship decision, the merge round owns the
  //                    bump, and nothing in this item is deployed.
  //   item 96-b    -- THE TWO LINES ITEM 96 LEFT UNTRUE. The hint under the calculator picker
  //                    still told the reader that every price is theirs to type, and the item 95
  //                    block header still told the next reader that nothing here is fetched and
  //                    that the feature declares no storage key. Both are text, and nothing in
  //                    the worker changed on account of either -- but app.js is in CORE and the
  //                    bundle carries both: 1512566 -> 1513535 (+969) under an index.html that
  //                    did not move. So CORE_BYTES followed 2498394 -> 2499363, re-cut from the
  //                    disk by node tools/core-bytes.cjs --write and never by hand, and the byte
  //                    table above that constant and the figure in the table at :2073 carry the
  //                    same measurement. Both sw.js edits and that figure were made first; this
  //                    digest was cut LAST, after all of them, on a tree measured at CR = 0.
  //                    CACHE is NOT touched: the store name is a ship decision, the merge round
  //                    owns the bump, and nothing in this item is deployed.
  //   item 99      -- THE BYTE LEDGER FOLLOWS THE FILES IT SEALS. CORE itself did not change --
  //                    no file entered it and none left -- but index.html AND app.js are both in
  //                    CORE and both moved in this repair round. index.html carries the closing
  //                    screen's structured data below the body instead of in the head and two
  //                    store links fewer in its noscript: 152137 -> 153974 (+1837). app.js was
  //                    rebuilt by node tools/build-app.cjs from an app.jsx that draws the closing
  //                    block on the last card only: 1513535 -> 1518634 (+5099). So CORE_BYTES
  //                    followed 2499363 -> 2506299 = the two deltas summed, re-cut from the disk
  //                    by node tools/core-bytes.cjs --write and never by hand, and the byte table
  //                    above that constant and the two figures in the table at :2094 and :2102
  //                    carry the same measurement. sw.js is NOT in CORE, so the constant is not
  //                    a fixed point and one pass settles it. Both sw.js edits and those two
  //                    figures were made first; this digest was cut LAST, after all of them, on a
  //                    tree measured at CR = 0. CACHE is NOT touched: the store name is a ship
  //                    decision, the merge round owns the bump, and nothing in this item is
  //                    deployed.
  //   item 99 ship -- THE STORE NAME FOR THE SHIP. This is the merge round that sw.js:48 and the
  //                    note above SW_CACHE both defer the bump to, so the bump is made here:
  //                    CACHE ezik-v33 -> ezik-v34 in sw.js, and SW_CACHE below with it, in this
  //                    one commit. THE SHIP ROUND RAISED THE CACHE NAME SO THE NEW SHELL REACHES
  //                    READERS WHO ALREADY CARRY THE OLD ONE: a returning reader holds the old
  //                    bundle in the old store, and only a changed worker installs, sweeps every
  //                    store that is not the new name in activate, and hands them this item
  //                    instead of the build they already have. NOTHING ELSE IN THE WORKER MOVED.
  //                    NO CORE FILE CHANGED -- none entered CORE and none left it, and
  //                    index.html, app.js and every other CORE entry are byte for byte what this
  //                    branch already carried and what the gates passed on -- so NO BYTE FIGURE
  //                    MOVED: CORE_BYTES is still 2506299, re-measured against the disk by node
  //                    tools/core-bytes.cjs, and the byte table above that constant and the
  //                    SW_PROSE mirror below are untouched. The two store names are the same
  //                    eight characters, so sw.js is 46792 bytes before and after this edit. THIS
  //                    digest is re-cut LAST, after the sw.js edit, on a tree measured at CR = 0.
  //   2026-09-13   -- ITEM 94: THE SHARE CARD IS DRAWN ONLY FOR AN ATTRIBUTED REPLY, AND SHRINKS
//                    BEFORE IT CUTS. INDEX.HTML DID NOT MOVE this round -- everything is in
//                    app.jsx -- so the shell figure and its mirror were already true and only the
//                    BUNDLE figures moved. app.js was rebuilt 1529930 -> 1533210 (+3280) by node
//                    tools/build-app.cjs, and CORE_BYTES was re-cut 2517595 -> 2520875 (+3280) by
//                    node tools/core-bytes.cjs --write, which is exactly the bundle delta because
//                    the shell did not grow. The worker table at :121 and the app.js mirror below
//                    followed, and THIS digest is re-cut LAST. SW.JS IS OTHERWISE UNTOUCHED and
//                    CACHE IS NOT BUMPED: this is a branch for the owner to preview, not a ship.
  //   2026-09-13   -- ITEM 89: THE FORTY NAWAWI, WITH IBN RAJAB'S ADDITIONS, AS A SECTION.
//                    INDEX.HTML DID NOT MOVE this round either -- the section is app.jsx, one new
//                    root file (arbaeen.json, NOT in CORE), the guard inventory and the handoff --
//                    so the shell figure and its mirror were already true and only the BUNDLE
//                    figures moved. app.js was rebuilt 1533210 -> 1544535 (+11325) by node
//                    tools/build-app.cjs, and CORE_BYTES was re-cut 2520875 -> 2532200 (+11325) by
//                    node tools/core-bytes.cjs --write, which is exactly the bundle delta because
//                    the shell did not grow. The worker table at :121 and the app.js mirror below
//                    followed, and THIS digest is re-cut LAST. SW.JS IS OTHERWISE UNTOUCHED and
//                    CACHE IS NOT BUMPED: this is a branch for the owner to preview, not a ship.
  //   2026-09-13   -- ITEM 27: THE DAILY VERSE CARD OPENS ITS TAFSIR. INDEX.HTML DID NOT MOVE this
//                    round either -- the screen is app.jsx, one new root file (daily-tafsir.json,
//                    NOT in CORE), the guard inventory and the handoff -- so the shell figure and
//                    its mirror were already true and only the BUNDLE figures moved. app.js was
//                    rebuilt 1544535 -> 1550360 (+5825) by node tools/build-app.cjs, and
//                    CORE_BYTES was re-cut 2532200 -> 2538025 (+5825) by node
//                    tools/core-bytes.cjs --write, which is exactly the bundle delta because the
//                    shell did not grow. The worker table at :121 and the app.js mirror below
//                    followed, and THIS digest is re-cut LAST. SW.JS IS OTHERWISE UNTOUCHED and
//                    CACHE IS NOT BUMPED: this is a branch for the owner to preview, not a ship.
  //   2026-09-13-ii -- ITEM 92-ج, THE ERASE: the owner's inbox gains delete-one, delete-selected
//                    and delete-the-whole-tab. INDEX.HTML DID NOT MOVE this round either -- the
//                    three controls are app.jsx and the sixth action is a SERVER FUNCTION
//                    (api/inbox.js, which is not an asset, is not in CORE and is not sealed
//                    here), and no root file was added -- so the shell figure and its mirror were
//                    already true and only the BUNDLE figures moved. app.js was rebuilt
//                    1683961 -> 1697965 (+14004) by node tools/build-app.cjs, and CORE_BYTES was
//                    re-cut 2772292 -> 2786296 (+14004) by node tools/core-bytes.cjs --write,
//                    which is exactly the bundle delta because the shell did not grow. The worker
//                    table at :121 and the app.js mirror below followed, and THIS digest is re-cut
//                    LAST. SW.JS IS OTHERWISE UNTOUCHED and CACHE IS NOT BUMPED: this is a branch
//                    for the owner to preview, not a ship, and sw.js says the merge round owns
//                    the bump.
  //   2026-09-13   -- ITEM 92-ج: THE OWNER'S INBOX. INDEX.HTML DID NOT MOVE this round either --
//                    the two panels are app.jsx, the route is a SERVER FUNCTION (api/inbox.js,
//                    which is not an asset, is not in CORE and is not sealed here), and no root
//                    file was added -- so the shell figure and its mirror were already true and
//                    only the BUNDLE figures moved. app.js was rebuilt 1652685 -> 1683961 (+31276)
//                    by node tools/build-app.cjs, and CORE_BYTES was re-cut 2741016 -> 2772292
//                    (+31276) by node tools/core-bytes.cjs --write, which is exactly the bundle
//                    delta because the shell did not grow. The worker table at :121 and the app.js
//                    mirror below followed, and THIS digest is re-cut LAST. SW.JS IS OTHERWISE
//                    UNTOUCHED and CACHE IS NOT BUMPED: this is a branch for the owner to preview,
//                    not a ship, and sw.js says the merge round owns the bump.
  //   2026-09-14   -- ITEM 87: THE DAY, FROM WAKING TO SLEEPING. INDEX.HTML DID NOT MOVE this
//                    round -- the section is app.jsx and ONE new root file -- so the shell figure
//                    and its mirror were already true. But that file JOINS CORE, which is the
//                    difference from the three rounds above it: sunan-day.json (84759 bytes, 138
//                    rows in eight phases) is precached beside arbaeen.json, so SW_CORE and
//                    SW_CORE_FILES gained an entry and SW_PROSE gained a row, and CORE_BYTES is
//                    NOT the bundle delta alone this time. app.js was rebuilt 1697965 -> 1711339
//                    (+13374) by node tools/build-app.cjs, and CORE_BYTES was re-cut
//                    2786296 -> 2884429 (+98133) by node tools/core-bytes.cjs --write, which is
//                    that bundle delta plus the 84759 the new CORE entry weighs. The worker's own
//                    byte table above the constant gained a term for it and the app.js mirror
//                    below followed, and THIS digest is re-cut LAST, after every other sw.js edit
//                    was final. SW.JS IS OTHERWISE UNTOUCHED -- no route, no store and no branch
//                    of it moved -- and CACHE IS NOT BUMPED: install rewrites every CORE entry
//                    into the same store, and sw.js says the merge round owns the bump.
  //   2026-09-14-ii -- ORDER 87D: ITEM 87 MOVES FROM THE SIDE DRAWER ONTO THE HOME SHELF. The
//                    owner ruled that the day from waking to sleeping is a SECTION of Ezik and
//                    sits immediately after the adhkar, so the drawer row was removed and a
//                    twelfth tile took its place. INDEX.HTML DID NOT MOVE and NO FILE JOINED OR
//                    LEFT CORE this round -- sunan-day.json is byte-identical to the round above
//                    and is still precached -- so SW_CORE, SW_CORE_FILES and every row of
//                    SW_PROSE but one were already true. app.js was rebuilt 1711339 -> 1713640
//                    (+2301) by node tools/build-app.cjs, and CORE_BYTES was re-cut
//                    2884429 -> 2886730 (+2301) by node tools/core-bytes.cjs --write, which is
//                    exactly the bundle delta because the shell did not grow and CORE gained
//                    nothing. The worker's own byte table above the constant and the app.js
//                    mirror below followed, and THIS digest is re-cut LAST, after every other
//                    sw.js edit was final. SW.JS IS OTHERWISE UNTOUCHED -- no route, no store
//                    and no branch of it moved -- and CACHE IS NOT BUMPED: the merge round owns
//                    the bump.
  //   2026-09-14-iii -- ITEM 88 DEFECT 5+6: THE THROTTLE GETS ITS OWN SENTENCE. /api/articles-list
//                    answered 429 to 48 of the check round's requests and every one reached the reader as the
//                    outage line, so ezikArticlesFetchList now carries the status out and the two sections draw
//                    a fourth state. INDEX.HTML DID NOT MOVE and NO FILE JOINED OR LEFT CORE this round -- the
//                    only CORE entry that changed size is the bundle. app.js was rebuilt 1713640 -> 1715759
//                    (+2119) by node tools/build-app.cjs, and CORE_BYTES was re-cut 2886730 -> 2888849 (+2119),
//                    verified by node tools/core-bytes.cjs, which is exactly the bundle delta because the shell
//                    did not grow and CORE gained nothing. The worker's own byte table above the constant and
//                    the app.js mirror below followed, and THIS digest is re-cut LAST, after every other sw.js
//                    edit was final. SW.JS IS OTHERWISE UNTOUCHED -- no route, no store and no branch of it
//                    moved -- and CACHE IS NOT BUMPED: the merge round owns the bump.
  //   2026-09-14-iv -- ITEM 88 DEFECT 4: THE COMPLAINT DOOR SAYS WHAT BECAME OF THE MESSAGE
//                    BEFORE IT MOVES ANYWHERE. It sets the refusal line and no longer navigates on the same tick,
//                    so the sentence is actually painted; the hand-off to الإعدادات is now the reader's own press
//                    on the button beside it. Neither half touches a route, a store or a cached file. INDEX.HTML
//                    DID NOT MOVE and NO FILE JOINED OR LEFT CORE this round -- the only CORE entry that changed
//                    size is the bundle. app.js was rebuilt 1715759 -> 1717162 (+1403) by node tools/build-app.cjs,
//                    and CORE_BYTES was re-cut 2888849 -> 2890252 (+1403), verified by node tools/core-bytes.cjs,
//                    which is exactly the bundle delta because the shell did not grow and CORE gained nothing. The
//                    worker's own byte table above the constant and the app.js mirror below followed, and THIS
//                    digest is re-cut LAST, after every other sw.js edit was final. SW.JS IS OTHERWISE UNTOUCHED
//                    -- no route, no store and no branch of it moved -- and CACHE IS NOT BUMPED: the merge round
//                    owns the bump.
  //   2026-09-14-v -- ITEM 88 DEFECT 13: THE GREETING NO LONGER ENDS ON A VOCATIVE WITH NOBODY
//                    AFTER IT. A whole-sentence key joins home.hello and is drawn instead of it when the app has
//                    no name for the reader. Nothing else moves. INDEX.HTML DID NOT MOVE and NO FILE JOINED OR
//                    LEFT CORE this round -- the only CORE entry that changed size is the bundle. app.js was
//                    rebuilt 1717162 -> 1717848 (+686) by node tools/build-app.cjs, and CORE_BYTES was re-cut
//                    2890252 -> 2890938 (+686), verified by node tools/core-bytes.cjs, which is exactly the bundle
//                    delta because the shell did not grow and CORE gained nothing. The worker's own byte table
//                    above the constant and the app.js mirror below followed, and THIS digest is re-cut LAST,
//                    after every other sw.js edit was final. SW.JS IS OTHERWISE UNTOUCHED -- no route, no store
//                    and no branch of it moved -- and CACHE IS NOT BUMPED: the merge round owns the bump.
  //   2026-09-14-vi -- ITEM 88 DEFECT 12: THE ADHKAR CHEST NAMES THE SECTION ABOVE THE GROUP.
//                    The group that opens and the order of the groups are UNCHANGED -- only a label was added over
//                    the title, read from the same module.adhkar key the shelf tile draws. INDEX.HTML DID NOT MOVE
//                    and NO FILE JOINED OR LEFT CORE this round -- the only CORE entry that changed size is the
//                    bundle. app.js was rebuilt 1717848 -> 1718515 (+667) by node tools/build-app.cjs, and
//                    CORE_BYTES was re-cut 2890938 -> 2891605 (+667), verified by node tools/core-bytes.cjs, which
//                    is exactly the bundle delta because the shell did not grow and CORE gained nothing. The
//                    worker's own byte table above the constant and the app.js mirror below followed, and THIS
//                    digest is re-cut LAST, after every other sw.js edit was final. SW.JS IS OTHERWISE UNTOUCHED
//                    -- no route, no store and no branch of it moved -- and CACHE IS NOT BUMPED: the merge round
//                    owns the bump.
  //   2026-09-14-vii -- ITEM 88 DEFECT 14: A REFRESH IN THE MIDDLE OF A SECTION COMES BACK TO IT.
//                    One sessionStorage key records the shelf id the reader pressed; the boot effect and four lazy
//                    initialisers read it back, «delete all my data» sweeps it, and the theme-coverage guard's N10
//                    asserts the same claim it always did against the destination's new spelling. The FIRST opening
//                    of the app still lands on the chat, because a new tab has no session record. No route, no store
//                    and no cached file is involved. INDEX.HTML DID NOT MOVE and NO FILE JOINED OR LEFT CORE this
//                    round -- the only CORE entry that changed size is the bundle. app.js was rebuilt 1718515 ->
//                    1724747 (+6232) by node tools/build-app.cjs, and CORE_BYTES was re-cut 2891605 -> 2897837
//                    (+6232), verified by node tools/core-bytes.cjs, which is exactly the bundle delta because the
//                    shell did not grow and CORE gained nothing. The worker's own byte table above the constant and
//                    the app.js mirror below followed, and THIS digest is re-cut LAST, after every other sw.js edit
//                    was final. SW.JS IS OTHERWISE UNTOUCHED -- no route, no store and no branch of it moved -- and
//                    CACHE IS NOT BUMPED: the merge round owns the bump.
  //   2026-09-15-i -- ITEM 88 BATCH B, ITEM 1: A RELOAD INSIDE THE MUSHAF LANDS ON THE INDEX, NOT ON
//                    THE READING PAGE. The item-14 repair returned the reader to the page he was on, and that page
//                    carries no way to the shelf; entering المصحف from the shelf still opens where he left off, so
//                    item 87 is untouched. INDEX.HTML DID NOT MOVE and NO FILE JOINED OR LEFT CORE this round -- the
//                    only CORE entry that changed size is the bundle. app.js was rebuilt 1724747 -> 1727829 (+3082)
//                    by node tools/build-app.cjs, and CORE_BYTES was re-cut 2897837 -> 2900919 (+3082), verified by
//                    node tools/core-bytes.cjs, which is exactly the bundle delta because the shell did not grow and
//                    CORE gained nothing. The worker's own byte table above the constant and the app.js mirror below
//                    followed, and THIS digest is re-cut LAST, after every other sw.js edit was final. SW.JS IS
//                    OTHERWISE UNTOUCHED -- no route, no store and no branch of it moved -- and CACHE IS NOT BUMPED:
//                    the merge round owns the bump.
  //   2026-09-15-ii -- ITEM 88 BATCH B, ITEM 2: THE ADHKAR OPEN ON THE WHOLE CATALOGUE. The clock's
//                    door is removed from the section's front entrance by the owner's words; no other entrance and no
//                    group order changes. INDEX.HTML DID NOT MOVE and NO FILE JOINED OR LEFT CORE this round -- the
//                    only CORE entry that changed size is the bundle. app.js was rebuilt 1727829 -> 1728316 (+487) by
//                    node tools/build-app.cjs, and CORE_BYTES was re-cut 2900919 -> 2901406 (+487), verified by node
//                    tools/core-bytes.cjs, which is exactly the bundle delta because the shell did not grow and CORE
//                    gained nothing. The worker's own byte table above the constant and the app.js mirror below
//                    followed, and THIS digest is re-cut LAST, after every other sw.js edit was final. SW.JS IS
//                    OTHERWISE UNTOUCHED -- no route, no store and no branch of it moved -- and CACHE IS NOT BUMPED:
//                    the merge round owns the bump.
  //   2026-09-15-iii -- ITEM 88 BATCH B, ITEM 3: A SAVED CONVERSATION OPENED FROM THE SIDE MENU NOW
//                    MOVES THE SCREEN TO THE CHAT. One line inside openSavedChat, where every door to a saved
//                    conversation passes; no call site and no history layer changes. INDEX.HTML DID NOT MOVE and NO
//                    FILE JOINED OR LEFT CORE this round -- the only CORE entry that changed size is the bundle.
//                    app.js was rebuilt by node tools/build-app.cjs, and CORE_BYTES was re-cut by the same delta,
//                    verified by node tools/core-bytes.cjs, because the shell did not grow and CORE gained nothing.
//                    The worker's own byte table above the constant and the app.js mirror below followed, and THIS
//                    digest is re-cut LAST, after every other sw.js edit was final. SW.JS IS OTHERWISE UNTOUCHED --
//                    no route, no store and no branch of it moved -- and CACHE IS NOT BUMPED: the merge round owns
//                    the bump.
  //   2026-09-15 merge -- ITEM 88, THE MERGE ROUND: THE STORE NAME IS BUMPED ezik-v34 -> ezik-v35.
//                    Every seal note in this trip deferred the bump to the merge round, and this is it, so a
//                    returning reader who holds the old bundle in the old store gets a changed worker that
//                    installs, sweeps every store that is not the new name, and hands him this trip. NOTHING
//                    ELSE IN SW.JS MOVED -- no route, no branch and no byte table -- and the file is the same
//                    48510 bytes because the new name is the same length as the old. SW_CACHE below follows
//                    it in this same commit, and THIS digest is re-cut LAST, after the name was final.
  //   2026-09-15-e -- SIDE ROUND, REBASE ONTO ITEM 88: THE STORE NAME GOES ONE STEP,
//                    ezik-v35 -> ezik-v36. The merge round bumped v34 -> v35 for its own trip and
//                    said so above; this branch then rebased onto it and REBUILT, so the worker
//                    this tree ships is not the worker v35 named -- app.js is 1766936 bytes here
//                    and CORE_BYTES is 2940026, neither of them the figure v35 was cut against.
//                    A returning reader holding the v35 store would otherwise keep a bundle this
//                    tree no longer builds, so the name moves one step and activate sweeps it.
//                    INDEX.HTML DID NOT MOVE and NO FILE JOINED OR LEFT CORE. sw.js is 48510 bytes
//                    before and after the bump, because the new name is the same length as the old;
//                    what moved inside it is the name, the byte table's app.js figure and
//                    CORE_BYTES, the last two re-cut by node tools/core-bytes.cjs --write and not by
//                    hand. SW_CACHE above follows the name in this same commit, and THIS digest is
//                    re-cut LAST, after every other sw.js edit was final.
  //   2026-09-16-a -- SIDE ROUND, ITEM 102: THE ANSWER IS TYPED INSTEAD OF FLASHED AND THE PAGE
//                    STAYS ON THE QUESTION. INDEX.HTML DID NOT MOVE and NO FILE JOINED OR LEFT
//                    CORE: the whole item is app.jsx -- the reveal queue gained a ceiling, the
//                    completion waits for that queue instead of emptying it, and the ask pin is no
//                    longer disarmed by the turn going quiet. So the shell figure and its mirror
//                    were already true and only the BUNDLE figures moved. app.js was rebuilt from
//                    app.jsx by node tools/build-app.cjs, 1766936 -> 1776728 (+9792), and
//                    CORE_BYTES was re-cut 2940026 -> 2949818 (+9792) by node
//                    tools/core-bytes.cjs --write and not by hand. sw.js is 48510 bytes before and
//                    after, because both figures are the same seven digits wide.
//                    SW_CACHE IS DELIBERATELY NOT BUMPED HERE, and that is a decision and not an
//                    oversight: the CORE_BYTES prose above says the store name is a ship decision
//                    the merge round owns, and this branch is neither shipped nor pushed. The
//                    2026-09-15-e entry bumped it for the opposite reason -- that branch WAS the
//                    trip -- so whoever ships this one decides the name, and the report for item
//                    102 says so out loud rather than leaving it to be noticed.
//                    THIS digest is re-cut LAST, after every other sw.js edit was final.
  //   2026-09-16-b -- ITEM 102 GOES TO THE MERGE ROUND: THE STORE NAME GOES ONE STEP,
//                    ezik-v36 -> ezik-v37. This ANSWERS the question 2026-09-16-a left open one
//                    commit ago. That entry re-sealed the size and deliberately did NOT bump the
//                    name, because the CORE_BYTES prose calls the name a ship decision the merge
//                    round owns and that branch was not yet shipping. It is now, so the round
//                    that owns the bump is this one and the name moves.
//                    WHY IT HAS TO MOVE. app.js is 1776728 bytes here against the 1766936 the
//                    v36 store was cut for, so a returning reader holding v36 would keep serving
//                    a bundle this tree no longer builds. activate sweeps every name that is not
//                    the current one, so one step is the whole repair.
//                    NOTHING ELSE IN SW.JS MOVED -- no route, no branch, no byte table and no
//                    constant -- and the file is the same 48510 bytes, because v37 is the same
//                    width as v36. TWO LIVE SITES CARRY THIS NAME and both moved in this commit:
//                    `const CACHE` in sw.js and `const SW_CACHE` here. The match was word-bounded
//                    and ezik-mushaf-pages-v1 was counted before and after and did not move --
//                    bumping THAT store would wipe tens of megabytes of page scans off readers'
//                    devices, and it is a different store with a different life.
//                    THIS digest is re-cut LAST, after the name was final.
  //   2026-09-16-c -- SIDE ROUND, ITEM 106: THE APP VERSION HAS ONE SOURCE. INDEX.HTML DID NOT
//                    MOVE and NO FILE JOINED OR LEFT CORE: tools/build-app.cjs now writes one
//                    line, var EZIK_APP_VERSION, from config/app-version.json at the top of the
//                    bundle, and app.jsx sends it with a feedback message. So only the BUNDLE
//                    figures moved. app.js was rebuilt by node tools/build-app.cjs, 1776728 ->
//                    1777203 (+475), and CORE_BYTES was re-cut 2949818 -> 2950293 (+475) by node
//                    tools/core-bytes.cjs --write and not by hand. sw.js is 48510 bytes before and
//                    after. SW_CACHE IS NOT BUMPED: the store name is the merge round's decision.
//                    THIS digest is re-cut LAST, after every other sw.js edit was final.
  //   2026-09-16-d -- ITEM 106-B: THE STORE NAME MOVES ONE STEP AND IS READ FROM ONE SOURCE.
//                    CACHE in sw.js and app_version in config/app-version.json moved v37 -> v38
//                    together, and SW_CACHE here stopped being typed: it is read from that file, so
//                    B11 now holds sw.js to the version file. app.jsx gained the version on the
//                    owner inbox rows, so app.js was rebuilt by node tools/build-app.cjs, 1777203 ->
//                    1777634 (+431), and CORE_BYTES was re-cut 2950293 -> 2950724 (+431) by node
//                    tools/core-bytes.cjs --write. INDEX.HTML DID NOT MOVE and no file joined or left
//                    CORE. sw.js is 48510 bytes before and after (same-width name and figures).
//                    THIS digest is re-cut LAST, after every other sw.js edit was final.
  //   2026-09-16-e -- ITEM 106-D: THE VERSION RIDES THE REPORT PATH, CLEANED AND NEVER STAMPED.
//                    app.jsx's report sender now carries appv from the same built constant the
//                    feedback sender uses; api/report.js keeps it only if it has a build's shape
//                    and otherwise stores '' -- it imports nothing new. The store name did NOT
//                    move -- it stays at v38. app.js was rebuilt by node tools/build-app.cjs,
//                    1777634 -> 1777656 (+22), and CORE_BYTES was re-cut 2950724 -> 2950746 (+22)
//                    by node tools/core-bytes.cjs --write. INDEX.HTML DID NOT MOVE and no file joined
//                    or left CORE. sw.js is 48510 bytes before and after.
//                    THIS digest is re-cut LAST, after every other sw.js edit was final.
  //   2026-09-17 -- ITEM 10: THE KUNUZ MODES REPLACE THE TREASURE JOURNEY. ONE LINE OF SW.JS
//                    MOVED: the network-only branch for the quest surface matched
//                    '/quest.html' OR '/quest-data/', and now matches the prefix '/quest', so
//                    quest-ghaws.html and quest-harb.html are never cached either. sw.js is
//                    48510 -> 48468 bytes. NO FILE JOINED OR LEFT CORE and nothing in CORE moved:
//                    app.js, app.jsx and index.html are byte-identical, so CORE_BYTES and the
//                    byte table stand. The store name did NOT move. B11 now dispatches all four
//                    Kunuz paths. THIS digest is re-cut LAST, after every other sw.js edit was final.
  //   2026-09-17-b -- ITEM 13-B: THE KUNUZ HOME BUTTON OPENS THE SECTIONS. app.jsx gained one
//                    resume id, home: 'home', in EZIK_RESUME_SCREENS, so a Kunuz page that writes
//                    it before leaving for / lands on the bare home screen instead of the chat.
//                    INDEX.HTML DID NOT MOVE and NO FILE JOINED OR LEFT CORE. app.js was rebuilt by
//                    npm run build:app, 1777656 -> 1777668 (+12), and CORE_BYTES was re-cut
//                    2950746 -> 2950758 (+12) by node tools/core-bytes.cjs --write; the byte table
//                    in sw.js and the SW_PROSE mirror of it in B14 follow. sw.js is 48468 bytes
//                    before and after. The store name did NOT move -- it is the merge round's call.
//                    THIS digest is re-cut LAST, after every other sw.js edit was final.
  //   2026-09-19   -- البند ٥٠ §٢: THE FOURTH CONFIDENCE MARK LEAVES THE HADITH CARD. app.jsx
//                    lost NEUTRAL_HADITH_LABEL and the two-way heading initialiser; the card
//                    heading is the constant SUNNAH_CARD_LABEL, «من السنة النبوية», for a card
//                    with attributes and for one without. INDEX.HTML DID NOT MOVE and NO FILE
//                    JOINED OR LEFT CORE. app.js was rebuilt by npm run build:app,
//                    1780467 -> 1782018 (+1551), and CORE_BYTES was re-cut 2953557 -> 2955108
//                    (+1551) by node tools/core-bytes.cjs --write; the byte table in sw.js:142
//                    and the SW_PROSE mirror of it in B14 follow, both 1780467 -> 1782018.
//                    sw.js is 48468 bytes before and after. The store name did NOT move -- it is
//                    the merge round's call. THIS digest is re-cut LAST, after every other sw.js
//                    edit was final.
  //   2026-09-26   -- THE NEW MUSHAF (mushaf_lab_v1) GOES TO MAIN. app.jsx gained MushafLabFrame, an
//                    iframe of /mushaf-lab/index.html opened before PagedMushaf behind a device flag,
//                    and resetAll gained ezikClearMushafLab, which sweeps the embedded reader's own
//                    lab.* keys. INDEX.HTML DID NOT MOVE and NO FILE JOINED OR LEFT CORE: mushaf-lab/
//                    is not precached. app.js was rebuilt by node tools/build-app.cjs,
//                    1782018 -> 1785502 (+3484), and CORE_BYTES was re-cut 2955108 -> 2958592
//                    (+3484) by node tools/core-bytes.cjs --write; the byte table in sw.js:142 and
//                    the SW_PROSE mirror of it in B14 follow, both 1782018 -> 1785502. sw.js is
//                    48468 bytes before and after, measured at CR = 0. The store name did NOT move
//                    -- it stays at v38, as it did for every app.js-only ship since 2026-09-16-d:
//                    the changed worker installs and rewrites every CORE entry into the same store.
//                    THIS digest is re-cut LAST, after every other sw.js edit was final.
  //   2026-09-27   -- ITEM 4 OF THE REGISTER (OFFLINE): THREE DATA FILES JOIN THE IDLE WARM AND
//                    THE STORE NAME MOVES ONE STEP, ezik-v38 -> ezik-v39. asmaa-dataset-final-r3.json,
//                    asmaa-rules-page-r2.json and worship-display.json were stored only once a reader
//                    had fetched them online, so a reader who had never opened those two sections
//                    online could not open them with no network. They are appended to IDLE, not
//                    CORE: guards/asmaa-attribution-guard.cjs holds the two sheets out of install
//                    (item 26: the boot must not carry them), and the three travel together. NO FILE
//                    JOINED OR LEFT CORE, so CORE_BYTES, the byte table and SW_CORE / SW_CORE_FILES
//                    stand; SW_PROSE gained the two sheet sizes the new IDLE note states, and the
//                    asmaa gate's note was corrected -- its check is unchanged. CACHE in sw.js and
//                    app_version in config/app-version.json moved together (SW_CACHE is read from that
//                    file), and app.js was rebuilt by npm run build:app: only its EZIK_APP_VERSION line
//                    moved, and it is 1785502 bytes before and after. sw.js is 48468 -> 49632
//                    bytes, measured at CR = 0. THIS digest is re-cut LAST, after every other sw.js edit
//                    was final.
  //   2026-09-27-b -- ITEM 4 OF THE REGISTER (OFFLINE), PART TWO: THE NEW MUSHAF OPENS AND READS WITH
//                    NO NETWORK. sw.js named mushaf-lab nowhere, so the iframe app.jsx opens found no
//                    stored document offline. IDLE gains the reader's same-origin files exactly as it
//                    requests them (index.html, app.js?v=5, style.css?v=4, the manifest, two icons,
//                    data/tables.json, meta.json, imlaei.json and the new offline-sizes.json); a
//                    navigation inside /mushaf-lab/ falls back to that document, never to '/'; ONE
//                    unversioned store, DOWNLOADS_CACHE = 'ezik-mushaf-downloads-v1', which activate
//                    never sweeps and evictOld still may (item 33's contract, unchanged); the page arm
//                    reads MUSHAF_CACHE, then that store, then the network, and the geometry request
//                    reads CACHE, then that store, then the network; a request carrying the
//                    x-ezik-download header is not also written into MUSHAF_CACHE or CACHE. Every other
//                    origin is still ignored. NO FILE JOINED OR LEFT CORE: CORE_BYTES, the byte table,
//                    SW_CORE and SW_CORE_FILES stand (tools/core-bytes.cjs: MATCH), and the new prose
//                    states no number, so SW_PROSE is unchanged. The store name stays ezik-v39: this
//                    branch is not merged, so the one bump of 2026-09-27 carries both commits. B17 below
//                    executes all of it. sw.js is 49632 -> 55702 bytes, measured at CR = 0.
//                    THIS digest is re-cut LAST, after every other sw.js edit was final.
  //   2026-09-27-c -- VOICE + CALL T4 FIX 1, P1: THE CALL SPEAKS AN EARLY-RELEASED LEAD AT ONCE.
//                    lastSentenceCut in createCallSpeechStream now also counts a stop at the very end
//                    of the received text (. ! ? U+061F U+2026, never after a digit) as a sentence
//                    end. app.js was rebuilt by node tools/build-app.cjs, 1785502 -> 1785844, and
//                    CORE_BYTES was re-cut by node tools/core-bytes.cjs --write; the byte table in
//                    sw.js and the SW_PROSE mirror in B14 follow. NO FILE JOINED OR LEFT CORE and the
//                    store name does not move here (commit 3 of the fix moves it). sw.js is 55702
//                    bytes, measured at CR = 0. THIS digest is re-cut LAST, after every other sw.js
//                    edit was final.
  //   2026-09-27-d -- VOICE + CALL T4 FIX 1, P2: THE CALL PREFETCHES THE NEXT SENTENCE WHILE ONE PLAYS.
//                    createCallSpeechStream's pump fetched segment N+1 only after N had finished
//                    playing; it now starts that fetch when N is ready to play, one ahead as speakReply
//                    does, and a hang-up aborts it (fetchSpeechAudio takes an optional signal). app.js
//                    was rebuilt by node tools/build-app.cjs, 1785844 -> 1787023, and CORE_BYTES was
//                    re-cut by node tools/core-bytes.cjs --write; the byte table in sw.js and the
//                    SW_PROSE mirror in B14 follow. NO FILE JOINED OR LEFT CORE and the store name does
//                    not move here (commit 3 of the fix moves it). sw.js is 55702 bytes, measured at
//                    CR = 0. THIS digest is re-cut LAST, after every other sw.js edit was final.
  //   2026-09-27-e -- VOICE + CALL T4 FIX 1, THE STORE NAME MOVES ONE STEP, ezik-v39 -> ezik-v40, so the
//                    call's two speech fixes (P1, P2 above) reach readers through a fresh install. CACHE
//                    in sw.js and app_version in config/app-version.json moved together (SW_CACHE is read
//                    from that file), and app.js was rebuilt by npm run build:app: only its
//                    EZIK_APP_VERSION line moved, and it is 1787023 bytes before and after. NO FILE
//                    JOINED OR LEFT CORE: CORE_BYTES, the byte table and SW_PROSE stand. sw.js is 55702
//                    bytes, measured at CR = 0. THIS digest is re-cut LAST, after every other sw.js edit
//                    was final.
  //   2026-09-27-f -- VOICE + CALL T4 FIX 2, F1: ATTRIBUTION IS SILENT IN SPEECH (the owner's option A).
//                    formatForTTS now silences a line starting with the source label, every URL and
//                    every site or domain name; the hadith's collector and grading are still spoken,
//                    and the written reply is untouched. The call pump holds an unfinished source line
//                    for finish(). app.js was rebuilt by node tools/build-app.cjs, and CORE_BYTES was
//                    re-cut by node tools/core-bytes.cjs --write; the byte table in sw.js and the
//                    SW_PROSE mirror in B14 follow. NO FILE JOINED OR LEFT CORE and the store name
//                    stays ezik-v40 (already one step past live on this branch). sw.js is 55702 bytes,
//                    measured at CR = 0. THIS digest is re-cut LAST, after every other sw.js edit was
//                    final.
  //   2026-09-27-g -- VOICE + CALL T4 FIX 2, F2: THE MIC RE-OPENS ONLY AFTER OUR OWN VOICE HAS STOPPED.
//                    runCallTurn now waits the output latency the device reports
//                    (AudioContext.outputLatency, capped at 1000 ms, 0 when none is reported) between
//                    the last segment's `ended` and startCallListening. app.js was rebuilt by node
//                    tools/build-app.cjs, and CORE_BYTES was re-cut by node tools/core-bytes.cjs
//                    --write; the byte table in sw.js and the SW_PROSE mirror in B14 follow. NO FILE
//                    JOINED OR LEFT CORE and the store name stays ezik-v40. sw.js is 55702 bytes,
//                    measured at CR = 0. THIS digest is re-cut LAST, after every other sw.js edit was
//                    final.
  //   2026-09-27-h -- VOICE + CALL T4 FIX 2, F3: A SILENT DICTATION SESSION IS NOT RESTARTED.
//                    The composer's Web Speech onend restarted the engine unconditionally, and on
//                    Android every start plays the recognizer's own chime; a session that heard no
//                    words now ends dictation instead (a session that heard words still restarts).
//                    app.js was rebuilt by node tools/build-app.cjs, and CORE_BYTES was re-cut by
//                    node tools/core-bytes.cjs --write; the byte table in sw.js and the SW_PROSE
//                    mirror in B14 follow. NO FILE JOINED OR LEFT CORE and the store name stays
//                    ezik-v40. sw.js is 55702 bytes, measured at CR = 0. THIS digest is re-cut LAST,
//                    after every other sw.js edit was final.
  //   2026-09-27-i -- VOICE + CALL T4 FIX 3, G1: THE CAPTURE CONTEXT IS RESUMED.
//                    startCloudListening's AudioContext is created after an await getUserMedia inside
//                    an effect and was never resumed; a suspended context fed the VAD flat samples.
//                    It is resumed at once, and when it stays suspended one line asks for a tap that
//                    resumes it. app.js was rebuilt by node tools/build-app.cjs, and CORE_BYTES was
//                    re-cut by node tools/core-bytes.cjs --write; the byte table in sw.js and the
//                    SW_PROSE mirror in B14 follow. NO FILE JOINED OR LEFT CORE and the store name
//                    stays ezik-v40. sw.js is 55702 bytes, measured at CR = 0. THIS digest is
//                    re-cut LAST, after every other sw.js edit was final.
  //   2026-09-27-j -- VOICE + CALL T4 FIX 3, G2: THE CALL WAITS FOR THE DICTATION ONEND.
//                    The call entry effect stopped the dictation recognizer and called getUserMedia at
//                    once; on Android the recognizer holds the mic until its onend. An open session is
//                    now waited for (bound CALL_RESTART_GRACE_MS); with none, no wait is added.
//                    app.js was rebuilt by node tools/build-app.cjs, and CORE_BYTES was
//                    re-cut by node tools/core-bytes.cjs --write; the byte table in sw.js and the
//                    SW_PROSE mirror in B14 follow. NO FILE JOINED OR LEFT CORE and the store name
//                    stays ezik-v40. sw.js is 55702 bytes, measured at CR = 0. THIS digest is
//                    re-cut LAST, after every other sw.js edit was final.
  //   2026-09-27-k -- VOICE + CALL T4 FIX 3, G3: THE MICROPHONE MESSAGES NAME THEIR ERROR.
//                    Rows 9-12 end with the error name; in a browser row 9 points at the browser site
//                    settings and the phone settings, the shell keeps its text; a recorder/context
//                    failure after getUserMedia keeps its own name. app.js was rebuilt by node
//                    tools/build-app.cjs, and CORE_BYTES was
//                    re-cut by node tools/core-bytes.cjs --write; the byte table in sw.js and the
//                    SW_PROSE mirror in B14 follow. NO FILE JOINED OR LEFT CORE and the store name
//                    stays ezik-v40. sw.js is 55702 bytes, measured at CR = 0. THIS digest is
//                    re-cut LAST, after every other sw.js edit was final.
  //   2026-09-27-l -- THE READER'S V6 FIXES, REBASED ONTO ITEM 4. mushaf-lab/ took the owner's three fixes
//                    (Android inset bars, the page that follows the finger, no word marked by a touch) on
//                    top of the offline code, and its index.html now requests app.js?v=7 and style.css?v=7.
//                    The two IDLE entries follow those URLs exactly, as B17 requires, and the comment above
//                    them says why. NO FILE JOINED OR LEFT CORE (tools/core-bytes.cjs: MATCH), SW_PROSE states
//                    no number here, and CACHE stays ezik-v40: index.html is a network-first navigation, so
//                    the new pair is requested and stored under its new URLs. sw.js is 55702 -> 55908 bytes,
//                    measured at CR = 0. THIS digest is re-cut LAST, after every other sw.js edit was final.
  //   2026-09-27-m -- VOICE + CALL T4 FIX 4, H1: THE CALL SHOWS THE WORDS IT HEARD.
//                    A turn's transcript is shown under the call's state line, after a fixed prefix,
//                    before the answer is requested; it is cleared when the next turn listens and on
//                    hang-up, and it is never spoken. CallScreen takes one new prop, heardWords.
//                    app.js was rebuilt by node tools/build-app.cjs, and CORE_BYTES was
//                    re-cut by node tools/core-bytes.cjs --write; the byte table in sw.js and the
//                    SW_PROSE mirror in B14 follow. NO FILE JOINED OR LEFT CORE and the store name
//                    stays ezik-v40. sw.js is 55908 bytes, measured at CR = 0. THIS digest is
//                    re-cut LAST, after every other sw.js edit was final.
  //   2026-09-27-n -- VOICE + CALL T4 FIX 4, H2: A LEVEL GATE BETWEEN TURNS (OPTION A).
//                    The call keeps the peak RMS of every accepted turn; from the second turn on, a
//                    turn under 0.25 x their median (-12 dB) is dropped before /api/stt, one line
//                    shows in the error panel, and the mic re-opens. The first turn and the turn a
//                    barge-in opens always pass.
//                    app.js was rebuilt by node tools/build-app.cjs, and CORE_BYTES was
//                    re-cut by node tools/core-bytes.cjs --write; the byte table in sw.js and the
//                    SW_PROSE mirror in B14 follow. NO FILE JOINED OR LEFT CORE and the store name
//                    stays ezik-v40. sw.js is 55908 bytes, measured at CR = 0. THIS digest is
//                    re-cut LAST, after every other sw.js edit was final.
  //   2026-09-27-o -- VOICE + CALL T4 FIX 4, H3: NO SENTENCE END ON A DOMAIN'S DOT.
//                    lastSentenceCut's end-of-text rule no longer ends a sentence on a `.` after an
//                    ASCII letter, so a delta that stops at `binothaimeen.` waits for the rest of the
//                    domain; an Arabic sentence ending in `.` is still cut at once.
//                    app.js was rebuilt by node tools/build-app.cjs, and CORE_BYTES was
//                    re-cut by node tools/core-bytes.cjs --write; the byte table in sw.js and the
//                    SW_PROSE mirror in B14 follow. NO FILE JOINED OR LEFT CORE and the store name
//                    stays ezik-v40. sw.js is 55908 bytes, measured at CR = 0. THIS digest is
//                    re-cut LAST, after every other sw.js edit was final.
  //   2026-09-27-p -- VOICE + CALL T4 FIX 4, H4: AN EXTERNAL PAUSE IS NOT A FINISHED SEGMENT.
//                    playPreparedSpeech still ends a segment on the pause that comes with the end of
//                    the media; any other pause the app did not ask for cancels the rest of the
//                    answer, and on the call screen runs onCallTalk (the barge-in path).
//                    app.js was rebuilt by node tools/build-app.cjs, and CORE_BYTES was
//                    re-cut by node tools/core-bytes.cjs --write; the byte table in sw.js and the
//                    SW_PROSE mirror in B14 follow. NO FILE JOINED OR LEFT CORE and the store name
//                    stays ezik-v40. sw.js is 55908 bytes, measured at CR = 0. THIS digest is
//                    re-cut LAST, after every other sw.js edit was final.
  //   2026-09-27-q -- VOICE + CALL SHIP FIX 4, THE STORE NAME MOVES ONE STEP, ezik-v40 -> ezik-v41, so
//                    FIX 4 (H1-H4 above) reaches readers through a fresh install. CACHE in sw.js and
//                    app_version in config/app-version.json moved together (SW_CACHE is read from that
//                    file), and app.js was rebuilt by node tools/build-app.cjs: only its
//                    EZIK_APP_VERSION line moved, and it is 1799739 bytes before and after. NO FILE
//                    JOINED OR LEFT CORE: CORE_BYTES, the byte table and SW_PROSE stand. sw.js is 55702
//                    bytes, measured at CR = 0. THIS digest is re-cut LAST, after every other sw.js edit
//                    was final.
  //   2026-09-28-a -- WIDGET45 WEB2, THE COMPLETE OPEN/SOUND/DATA CONTRACT.
//                    The generated app.js changed 1799739 -> 1811970 bytes. CORE_BYTES was
//                    derived by tools/core-bytes.cjs --write, 2972829 -> 2985060; the worker's
//                    app.js prose row and the SW_PROSE mirror below followed. No asset joined
//                    or left CORE. CACHE and config/app-version.json move ezik-v41 -> ezik-v42
//                    because the stored bundle changed; app.js was regenerated and verified
//                    with that version stamp. sw.js is 55908 bytes at CR = 0. THIS digest was
//                    re-cut LAST, after the count, prose, mirror and cache edits were final.
  //   2026-09-28-b -- WIDGET REPLY COMPATIBILITY, B1/B2 FOLLOW-UP.
//                    The generated app.js changed 1811970 -> 1813455 bytes: page-scoped
//                    capability reserves one initial widget-data send and stops for the page
//                    after the legacy unknown-op reply. Supported replies release only queued
//                    changes. CORE_BYTES was derived by tools/core-bytes.cjs --write,
//                    2985060 -> 2986545; the worker's prose row and SW_PROSE mirror followed.
//                    No asset joined or left CORE. CACHE remains ezik-v42 by the owner's ruling.
//                    sw.js is 55908 bytes at CR = 0. THIS digest was re-cut LAST, after every
//                    count, prose and mirror edit was final.
  //   2026-09-28-c -- SOUND CONTROL VISIBILITY, FOLLOW-UP D.
//                    The generated app.js changed 1813455 -> 1813966 bytes. The sound control
//                    is shown only after this page establishes widget-data support; saved
//                    preferences and scheduled sound fields are unchanged. CORE_BYTES was
//                    derived by tools/core-bytes.cjs --write, 2986545 -> 2987056; the worker's
//                    app.js prose row and SW_PROSE mirror followed. No asset joined or left
//                    CORE. CACHE remains ezik-v42 by the owner's ruling. sw.js is 55908 bytes
//                    at CR = 0. THIS digest was re-cut LAST, after the count, prose and mirror.
  //   2026-09-28-a -- ITEM 108 (ORDER-108C): THE LIBRARY PAGE JOINS EZIK. app.jsx gained the
//                    library tile, the «ask Ezik» composer hand-off, the library erase in «delete all
//                    my data» and the book-card link; app.js was rebuilt by node tools/build-app.cjs,
//                    and CORE_BYTES was re-cut by node tools/core-bytes.cjs --write; the byte table in
//                    sw.js and the SW_PROSE mirror in B14 follow. /library.html is NOT in CORE (the
//                    navigation arm caches it network-first), NO FILE JOINED OR LEFT CORE and the store
//                    name stays ezik-v41. sw.js is 55908 bytes, measured at CR = 0. THIS digest is
//                    re-cut LAST, after every other sw.js edit was final.
  //   2026-09-28-d -- ORDER-108D MERGE OF origin/main (153ac5c) INTO lib108-integration. app.jsx merged
//                    with no conflict; app.js was REBUILT from it by node tools/build-app.cjs (never
//                    hand-merged), 1813966 -> 1820050 bytes (main plus item 108's +6084). CORE_BYTES was
//                    re-cut by node tools/core-bytes.cjs --write, 2987056 -> 2993140; the worker's app.js
//                    prose row and the SW_PROSE mirror followed. NO FILE JOINED OR LEFT CORE and the store
//                    name stays main's ezik-v42. sw.js is 55908 bytes, measured at CR = 0.
//                    THIS digest is re-cut LAST, after every other sw.js edit.
  //   2026-09-28-e -- ORDER-108D D2: BACK FROM THE LIBRARY REOPENS THE SAME CONVERSATION. app.jsx gained
//                    the thread note on a book-source tap, the boot's one-shot intents and the
//                    back-forward-cache clear; app.js was rebuilt by node tools/build-app.cjs,
//                    1820050 -> 1823469 bytes, and CORE_BYTES was re-cut by node tools/core-bytes.cjs
//                    --write, 2993140 -> 2996559; the worker's app.js prose row and the SW_PROSE mirror
//                    followed. NO FILE JOINED OR LEFT CORE and the store name stays ezik-v42. sw.js is
//                    55908 bytes, measured at CR = 0. THIS digest is re-cut LAST, after every other sw.js edit.
  //   2026-09-28-f -- ORDER-108D D2, THE BOOT RE-SHAPED SO THE RESUME PATH STAYS BYTE FOR BYTE: the intents
//                    are taken before the thread is emptied and the one reopen follows the destination.
//                    app.js was rebuilt by node tools/build-app.cjs, 1823469 -> 1823594 bytes; CORE_BYTES
//                    was re-cut by node tools/core-bytes.cjs --write, 2996559 -> 2996684; the prose row and
//                    the SW_PROSE mirror followed. NO FILE JOINED OR LEFT CORE; the store stays ezik-v42.
//                    sw.js is 55908 bytes, measured at CR = 0. THIS digest is re-cut LAST.
  //   2026-09-28-g -- TRIP 2 WIDGET SECTIONS: the widget whitelist opens the daily wird (wirdi) and the
//                    library. app.js was rebuilt by npm run build:app, 1823594 -> 1824038 bytes; CORE_BYTES
//                    was re-cut by node tools/core-bytes.cjs --write, 2996684 -> 2997128; the prose row and
//                    the SW_PROSE mirror followed. NO FILE JOINED OR LEFT CORE; the store stays ezik-v42.
//                    sw.js is 55908 bytes, measured at CR = 0. THIS digest is re-cut LAST.
  //   2026-09-28-h -- MUSHAF TOPBAR SHIP: CACHE and config/app-version.json move ezik-v42 -> ezik-v43.
  //                    npm run build:app regenerated app.js at the same 1824038 bytes. core-bytes.cjs
  //                    --write confirmed CORE_BYTES stays 2997128. sw.js stays 55908 bytes, CR = 0;
  //                    this seal was re-cut after the cache bump so returning readers refresh the lab.
  //   2026-09-27-r -- SPEED item 17 client branch (tagged 2026-09-27 on side/speed-20260927; re-tagged at the WASL merge, main holds that name): status frames, atomic cards and live offers.
  //                    app.js rebuilt by tools/build-app.cjs: 1785502 -> 1789622 (+4120).
  //                    CORE_BYTES re-derived by tools/core-bytes.cjs --write: 2958592 -> 2962712.
  //                    The worker byte table and SW_PROSE mirror follow the measured bundle.
  //                    sw.js remains 48468 bytes, CR = 0; this digest is cut LAST.
  //                    CACHE stays ezik-v38: this branch is not a ship; the merge round owns it.
  //   2026-09-27-s -- MERGE of origin/main dcc4e6f (item 4 offline) INTO side/speed-20260927 (speed item 17).
//                    (tagged 2026-09-27-c on side/speed-20260927; re-tagged at the WASL merge, main holds that name.)
//                    Both entries above stand. Main's worker (55702 bytes, CACHE ezik-v39, the mushaf-lab IDLE
//                    and DOWNLOADS_CACHE) takes this branch's CORE_BYTES 2962712 and its app.js byte-table row
//                    1789622; git merged the two sw.js sides with no conflict. app.js rebuilt from the merged
//                    app.jsx by tools/build-app.cjs: 1789622 bytes, --check OK (only EZIK_APP_VERSION moved to
//                    ezik-v39). tools/core-bytes.cjs: MATCH at 2962712, no re-cut. CACHE is not bumped here: the
//                    ship round owns it. sw.js is 55702 bytes, measured at CR = 0. THIS digest is re-cut LAST.
  //   2026-09-28-i -- SPEED WASL W0: MERGE OF origin/main e136e93 INTO side/speed-20260927 (speed item 17).
//                    Main's notes above stand as main wrote them; this branch's two notes follow them,
//                    re-tagged 2026-09-27-r and -s because main holds 2026-09-27 and 2026-09-27-c; their sizes
//                    were re-measured at their own commits (742ba33: app.js 1789622, sw.js 48468; c161286:
//                    sw.js 55702, app.js 1789622; CR = 0) and stand. sw.js was TAKEN FROM MAIN, not merged by
//                    hand (the ?v=7 and IDLE lines and CACHE ezik-v43 are main's). app.js was taken from main and
//                    REBUILT from the merged app.jsx by node tools/build-app.cjs: 1824038 -> 1828158 (+4120,
//                    this branch's client half), --check OK. CORE_BYTES re-cut by node tools/core-bytes.cjs
//                    --write, 2997128 -> 3001248; the worker's app.js prose row and the SW_PROSE mirror below
//                    followed. NO FILE JOINED OR LEFT CORE; the store name stays main's ezik-v43 (the release
//                    takes the next number, not this merge). sw.js is 55908 bytes, measured at CR = 0.
//                    THIS digest is re-cut LAST, after every other sw.js edit.
  //   2026-09-28-j -- SPEED W6B B5 (side/speed-20260927): the lessons block under an answer is drawn from the rows
//                    the server sends with it (the ezik_lessons frame); the client's answer-path search on the
//                    answer's words is removed. app.js REBUILT from app.jsx by node tools/build-app.cjs:
//                    1828158 -> 1821813 (-6345). CORE_BYTES re-cut by node tools/core-bytes.cjs --write,
//                    3001248 -> 2994903; the worker's app.js prose row and the SW_PROSE mirror below followed.
//                    NO FILE JOINED OR LEFT CORE; the store name stays ezik-v43 (the release takes the next
//                    number). sw.js is 55908 bytes, measured at CR = 0. THIS digest is re-cut LAST.
  //   2026-09-29-a -- SPEED SHIP (item 122, side/speed-20260927 daeae12 -> main): CACHE and config/app-version.json
//                    move ezik-v43 -> ezik-v44, the next number after the live one (origin/main e136e93 reads
//                    ezik-v43 in both). app.js REBUILT from app.jsx by npm run build:app: 1821813 bytes, unchanged
//                    in size (only EZIK_APP_VERSION moved), --check OK. node tools/core-bytes.cjs --write: MATCH,
//                    CORE_BYTES stays 2994903; the worker's app.js prose row and the SW_PROSE mirror stand.
//                    NO FILE JOINED OR LEFT CORE. The ?v=7 and IDLE lines are main's, untouched. sw.js is
//                    55908 bytes, measured at CR = 0. THIS digest is re-cut LAST, after every other sw.js edit.
  //   2026-10-01-a -- SORTER SHIP (order EZIK-SORTER-ORDER-2026-10-01, side/sorter-20261001): CACHE and config/app-version.json
//                    move ezik-v44 -> ezik-v45, the next number after the live one (origin/main a038bd7 reads ezik-v44).
//                    app.js REBUILT from app.jsx by npm run build:app: 1821813 bytes, only EZIK_APP_VERSION moved.
//                    node tools/core-bytes.cjs --write: MATCH, CORE_BYTES stays 2994903. NO FILE JOINED OR LEFT CORE.
//                    sw.js is 55908 bytes, measured at CR = 0. THIS digest is re-cut LAST.
  //   2026-10-01-b -- IMPERMISSIBLE SHIP (order EZIK-IMPERMISSIBLE-ORDER-2026-10-01, side/impermissible-20261001): CACHE and config/app-version.json
//                    move ezik-v45 -> ezik-v46, the next number after the sorter's (the live main a038bd7 still reads ezik-v44).
//                    app.js REBUILT from app.jsx by npm run build:app: 1821813 bytes, only EZIK_APP_VERSION moved.
//                    node tools/core-bytes.cjs --write: MATCH, CORE_BYTES stays 2994903. NO FILE JOINED OR LEFT CORE.
//                    sw.js is 55908 bytes, measured at CR = 0. THIS digest is re-cut LAST.
  //   2026-10-02 -- COMPREHENSIVE SHIP (order EZIK-COMPREHENSIVE-ORDER-2026-10-02, side/comprehensive-20261002): CACHE and config/app-version.json
//                    move ezik-v46 -> ezik-v47. app.js REBUILT from app.jsx by npm run build:app: 1828735 bytes (the auto-update block, the attach wait),
//                    1821813 -> 1828735 (+6922). node tools/core-bytes.cjs --write: CORE_BYTES 2994903 -> 3001825, then --check MATCH. NO FILE JOINED OR LEFT CORE.
//                    The sw.js prose line and the SW_PROSE mirror below carry the new app.js size. THIS digest is re-cut LAST, at CR = 0.
  //   2026-10-02 -- FIX 48 SHIP (order EZIK-FIX-48-ORDER-2026-10-02, side/comprehensive-20261002): CACHE and config/app-version.json move ezik-v47 -> ezik-v48.
//                    app.js REBUILT from app.jsx by npm run build:app: 1828735 bytes (unchanged: only EZIK_APP_VERSION moved, same length), sha256 c2fbc49e..32c5ad.
//                    node tools/core-bytes.cjs --write: CORE_BYTES stays 3001825, --check MATCH. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 55908 bytes).
  //   2026-10-03 -- FOLLOW-UP 49 SHIP (order EZIK-FOLLOWUP-49-ORDER-2026-10-03, side/comprehensive-20261002): CACHE and config/app-version.json move ezik-v48 -> ezik-v49.
//                    app.js REBUILT from app.jsx by npm run build:app: 1828735 bytes (unchanged: only EZIK_APP_VERSION moved, same length), sha256 0e2e58c9..3a1808.
//                    node tools/core-bytes.cjs --write: CORE_BYTES stays 3001825, --check MATCH. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 55908 bytes).
  //   2026-10-03 -- ORDER 50 SHIP (order EZIK-ORDER-50-2026-10-03, side/comprehensive-20261002): CACHE and config/app-version.json move ezik-v49 -> ezik-v50.
//                    app.js REBUILT from app.jsx by npm run build:app: 1828735 bytes (unchanged: only EZIK_APP_VERSION moved, same length), sha256 7cb05b9b..c440.
//                    node tools/core-bytes.cjs --write: CORE_BYTES stays 3001825, --check MATCH. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 55908 bytes).
  //   2026-10-03 -- ORDER 51 SHIP (order EZIK-ORDER-51-2026-10-03, side/comprehensive-20261002): CACHE and config/app-version.json move ezik-v50 -> ezik-v51.
//                    app.js REBUILT from app.jsx by npm run build:app: 1828735 bytes (unchanged: only EZIK_APP_VERSION moved, same length), sha256 2417778c..d8b1.
//                    node tools/core-bytes.cjs --write: CORE_BYTES stays 3001825, --check MATCH. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 55908 bytes).
  //   2026-10-04 -- ORDER 52B SHIP (order EZIK-ORDER-52B-2026-10-04, side/comprehensive-20261002): CACHE and config/app-version.json move ezik-v51 -> ezik-v52.
//                    app.js REBUILT from app.jsx by npm run build:app: 1828735 bytes (unchanged: only EZIK_APP_VERSION moved, same length), sha256 d6c07d0a..87db.
//                    node tools/core-bytes.cjs --write: CORE_BYTES stays 3001825, --check MATCH. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 55908 bytes).
  //   2026-10-04 -- ORDER 53 SHIP (order EZIK-ORDER-53-2026-10-04, side/comprehensive-20261002): CACHE and config/app-version.json move ezik-v52 -> ezik-v53.
//                    app.js REBUILT from app.jsx by npm run build:app: 1828735 bytes (unchanged: only EZIK_APP_VERSION moved, same length), sha256 37f6b122..3757.
//                    node tools/core-bytes.cjs --write: CORE_BYTES stays 3001825, --check MATCH. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 55908 bytes).
  //   2026-10-04 -- ORDER 54 SHIP (order EZIK-ORDER-54-2026-10-04, side/comprehensive-20261002): CACHE and config/app-version.json move ezik-v53 -> ezik-v54.
//                    app.js REBUILT from app.jsx by npm run build:app: 1828735 bytes (unchanged: only EZIK_APP_VERSION moved, same length), sha256 d234b0e5..36dd.
//                    node tools/core-bytes.cjs --write: CORE_BYTES stays 3001825, --check MATCH. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 55908 bytes).
  //   2026-10-10 -- ITEM 110 (rebase onto 4ddef38): app.js 2005096 -> 2019103 bytes, sha256 b89d9a81..0b60; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3234341. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (rebase onto 4ddef38): app.js 2019103 -> 2048842 bytes, sha256 d8f87ec2..1426; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3264080. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (rebase onto 4ddef38): app.js 2048842 -> 2049072 bytes, sha256 4da8ce69..8141; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3264310. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (rebase onto 4ddef38): app.js 2049072 -> 2049479 bytes, sha256 830560cc..dbc6; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3264717. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (AMEND-01: the menu of b (wird tile, compact prayer card, prayer settings sheet)): app.js 2049479 -> 2054843 bytes, sha256 cb8eb780..a9fb; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3270081. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (AMEND-01: one grid in every mode so a held tile keeps its node (touch drag)): app.js 2054843 -> 2055234 bytes, sha256 2b1f990c..9989; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3270472. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (AMEND-01: a held tile refuses the browser's long press (selection, menu)): app.js 2055234 -> 2055698 bytes, sha256 95b68ab1..60e3; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3270936. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (round 2: part fix (the item-127 fixes) in the owner switch): app.js 2055698 -> 2056391 bytes, sha256 a3a10ca0..c3f6; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3271629. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (round 2: the menu page of b (three groups, bar destinations not tiles)): app.js 2056391 -> 2057673 bytes, sha256 99fa4794..4f53; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3272911. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (round 2 fix m28: copy and quote without heading marks): app.js 2057673 -> 2058224 bytes, sha256 4baa627d..8892; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3273462. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (round 2 fix m27: the star is named with its state): app.js 2058224 -> 2059125 bytes, sha256 a861fd5d..695c; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3274363. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (round 2 fix m26: copy on the fatwa card): app.js 2059125 -> 2059439 bytes, sha256 c7d1c67b..a5c9; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3274677. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (round 2 fix m35: version in About): app.js 2059439 -> 2059750 bytes, sha256 a66a23a8..8932; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3274988. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (round 2 fix m34: tasbih spellings shown): app.js 2059750 -> 2060265 bytes, sha256 f3a78b0a..eb62; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3275503. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (round 2 fix m24: male/female labels): app.js 2060265 -> 2060481 bytes, sha256 9010201c..a67d; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3275719. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (round 2 fix m28 (2/2): strip at copy/share/quote): app.js 2060481 -> 2060431 bytes, sha256 1baf0909..c5e1; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3275669. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (round 2 fix m13: adhkar list keeps its place): app.js 2060431 -> 2061106 bytes, sha256 f488505f..6bf1; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3276344. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (round 2 fix m19: back to Settings): app.js 2061106 -> 2061926 bytes, sha256 f7804589..3743; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3277164. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (round 2 fix m7: mode and open answer survive the library): app.js 2061926 -> 2063834 bytes, sha256 e0eda86b..c289; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3279072. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (round 2 fix m6: library back without loop): app.js 2063834 -> 2064009 bytes, sha256 55977af0..39c7; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3279247. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (round 2 fix m21: lessons counts): app.js 2064009 -> 2067411 bytes, sha256 f6b40c37..79ed; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3282649. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (round 2 fix m10: ayah note autosave (mushaf-lab)): app.js 2067411 -> 2067411 bytes, sha256 f6b40c37..79ed; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3282649. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (round 2 fix m11: failed mushaf page retries online): app.js 2067411 -> 2068222 bytes, sha256 ecf25898..3496; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3283460. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (round 2 fix m2: notifications blocked line): app.js 2068222 -> 2071452 bytes, sha256 953f9b4a..e7bf; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3286690. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (round 2 fix m12: delete cancels reminders): app.js 2071452 -> 2072507 bytes, sha256 2fca2c19..d9c4; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3287745. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (round 2 fix m15: iqama on its own): app.js 2072507 -> 2072849 bytes, sha256 6b831194..ecb7; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3288087. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (round 2 fix m32: probe says a sentence): app.js 2072849 -> 2075120 bytes, sha256 72976267..15cc; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3290358. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (round 2 fix m14: slow first fix taken): app.js 2075120 -> 2077114 bytes, sha256 a6237b62..8a4d; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3292352. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (round 2: the empty chat of b without the mushaf card): app.js 2077114 -> 2077156 bytes, sha256 f6a08ed0..b843; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3292394. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (round 2: Settings of b in six groups): app.js 2077156 -> 2077554 bytes, sha256 0457c426..ea88; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3292792. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (round 2: section heads and one name per section (gate ez110names)): app.js 2077554 -> 2079263 bytes, sha256 6479965c..66be; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3294501. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (item 110 station: cache ezik-v89 (served ezik-v88 + 1)): app.js 2079263 -> 2079263 bytes, sha256 319329f6..491d; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3294501. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (item 110 round 3: menu of b one grid): app.js 2079263 -> 2079117 bytes, sha256 6d184c8d..b302; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3294355. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (item 110 round 3: bar of b): app.js 2079117 -> 2085426 bytes, sha256 742d9244..f12c; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3300664. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (item 110 round 3: empty chat of b): app.js 2085426 -> 2085437 bytes, sha256 a781c2df..576e; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3300675. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (item 110 round 3: answer controls of b): app.js 2085437 -> 2088997 bytes, sha256 7bc02665..e2d2; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3304235. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (item 110 round 3: sources in About of b): app.js 2088997 -> 2089613 bytes, sha256 8b3e5764..bdf3; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3304851. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (item 110 round 3: privacy page of b): app.js 2089613 -> 2092118 bytes, sha256 14630c59..78ac; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3307356. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (item 110 round 3: gender in b): app.js 2092118 -> 2098952 bytes, sha256 8f89ca7a..687a; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3314190. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (item 110 round 3: tip reads the edge family): app.js 2098952 -> 2098979 bytes, sha256 1b56a1ec..96db; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3314217. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (item 110 round 3: prayer section of b): app.js 2098979 -> 2100926 bytes, sha256 70329d6e..7854; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3316164. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (item 110 round 3: call-to-prayer card of b): app.js 2100926 -> 2104180 bytes, sha256 d0d36600..4469; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3319418. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (item 110 round 3: font choice of b): app.js 2104180 -> 2106820 bytes, sha256 c5d73350..06d3; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3322058. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (item 110 round 3: entry-run marker in App): app.js 2106820 -> 2106924 bytes, sha256 1e003414..e6bb; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3322162. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (item 110 station 2: cache ezik-v90 (served ezik-v89 + 1)): app.js 2106924 -> 2106924 bytes, sha256 6009e875..d099; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3322162. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (round 4 answer row): app.js 2106924 -> 2106924 bytes, sha256 6009e875..d099; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3322162. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (round 4 drawer share): app.js 2106924 -> 2106924 bytes, sha256 6009e875..d099; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3322162. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (round 4 sync privacy link): app.js 2106924 -> 2108209 bytes, sha256 fb72f4d4..9dea; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3323447. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (round 4 adhan card owner gate): app.js 2108209 -> 2109004 bytes, sha256 5319d162..20e6; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3324242. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (round 4 identity chooser): app.js 2109004 -> 2109022 bytes, sha256 e5ad83f9..0792; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3324260. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (round 4 arrange footer): app.js 2109022 -> 2109022 bytes, sha256 e5ad83f9..0792; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3324260. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (round 4 arrange actions): app.js 2109022 -> 2109022 bytes, sha256 e5ad83f9..0792; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3324260. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (round 4 back from pages): app.js 2109022 -> 2110443 bytes, sha256 666381f9..141c; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3325681. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (round 4 privacy back): app.js 2110443 -> 2111860 bytes, sha256 c2fc0e3a..4a7a; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3327098. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (round 4 library keeps search): app.js 2111860 -> 2111860 bytes, sha256 c2fc0e3a..4a7a; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3327098. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (round 4 pdf android shell): app.js 2111860 -> 2112460 bytes, sha256 6fa84503..2dac; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3327698. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (round 4 bar no keyboard): app.js 2112460 -> 2112929 bytes, sha256 dc93de53..d20a; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3328167. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (round 4 drawer delete name): app.js 2112929 -> 2112964 bytes, sha256 8cb27098..0b47; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3328202. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (round 4 tasbih hamzas): app.js 2112964 -> 2113284 bytes, sha256 2846fc0a..2422; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3328522. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (round 4 series order): app.js 2113284 -> 2114391 bytes, sha256 b8c941ba..b3d7; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3329629. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (round 4 tap 44): app.js 2114391 -> 2114439 bytes, sha256 6b3df91a..b1f4; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3329677. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (round 4 ayah digits): app.js 2114439 -> 2114667 bytes, sha256 7c338126..8029; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3329905. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (round 4 keys): app.js 2114667 -> 2115959 bytes, sha256 07cdefe9..7036; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3331197. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (round 4 women rule line): app.js 2115959 -> 2115987 bytes, sha256 cfddb818..9524; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3331225. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (round 4 tashkeel state): app.js 2115987 -> 2116060 bytes, sha256 96fad613..9451; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3331298. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (station 3 cache ezik-v91): app.js 2116060 -> 2116060 bytes, sha256 1d18b62c..85db; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3331298. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (r4a history read): app.js 2116060 -> 2116223 bytes, sha256 c6c60726..0d4a; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3331461. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (r4a storage read): app.js 2116223 -> 2116833 bytes, sha256 00aa68b4..315f; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3332071. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (R4A gender why-line by the owner item 58 rule): app.js 2116833 -> 2117504 bytes, sha256 14400ded..d347; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3332742. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (r4a tmp mark): app.js 2117504 -> 2117724 bytes, sha256 4794d2cc..e134; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3332962. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (r4a tmp core): app.js 2117724 -> 2117727 bytes, sha256 bdef39a0..0cd6; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3332965. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-11 -- Item 86 (memorizer) merge of origin/main 81c544a: app.js 2116060 -> 2222276 bytes, sha256 4c526961..55aa; index.html 155556.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3437684. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-12 -- Item 86 (memorizer) merge of origin/main e6c780a5: app.js 2222276 -> 2223943 bytes, sha256 fea84e47..84c8; index.html 155556.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3439351. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-12 -- Item 86 (memorizer) decisions 18 and 19: app.js 2223943 -> 2224605 bytes, sha256 cf6f42ea..d283; index.html 155556.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3440013. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (station 5 core: c and d public): app.js 2117727 -> 2117729 bytes, sha256 f2085add..4661; index.html 155386.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3332967. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-12 -- Item 86 (memorizer) merge of origin/main 3b4d7608: app.js 2224605 -> 2224607 bytes, sha256 8065a5ea..5cd9; index.html 155556.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3440015. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-12 -- Item 86 (memorizer, owner-only publish, cache ezik-v94): app.js 2224607 -> 2225743 bytes, sha256 0c90b3cc..ca97; index.html 155556.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3441151. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-12 -- Item 86 (memorizer, the recite restart anchor, owner-only, cache ezik-v95): app.js 2225743 -> 2228188 bytes, sha256 dcd7387e..0c94; index.html 155556.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3443596. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-12 -- Item 86 (memorizer, the owner's menu: four tabs, the page of blanks, the children's voice; owner-only, cache ezik-v96): app.js 2228188 -> 2233567 bytes, sha256 83e7ff2b..3ab0; index.html 155556.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3448975. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-12 -- Item 86 (memorizer, «سمِّعني» follows the owner: the window, the openings by name, moving on, the sticky bar, one row a result, the red-mark experiment; owner-only, cache ezik-v97): app.js 2233567 -> 2248906 bytes, sha256 4494d6c6..5f4d; index.html 155556.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3464314. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (the call-to-prayer card is public, gated on the shell widget-data capability (owner word 13 Oct 2026 00:46)): app.js 2248906 -> 2249595 bytes, sha256 b2bbbcc5..90b6; index.html 155556.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3465003. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (comment reword for gate wird (no bare protocol word)): app.js 2249595 -> 2249604 bytes, sha256 2bb84df8..5aa7; index.html 155556.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3465012. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-10 -- ITEM 110 (the App capability follower is named follow (widgetopen mutant needles stay unique)): app.js 2249604 -> 2249612 bytes, sha256 7b7ae26a..9a13; index.html 155556.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3465020. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-13 -- Item 86 (memorizer, phase 2: the owner's «سمِّعني» heard by his own engine on his own computer, the browser's when it does not answer; owner-only, cache ezik-v99): app.js 2249612 -> 2264726 bytes, sha256 c82b7610..3b2a; index.html 155556.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3480134. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57067 bytes).
  //   2026-10-13 -- Item 86 (memorizer, phase 2: a word the owner's engine did not hear -- an ayah passed over, or the end of one left early -- is never printed: red with his switch on, a blank with it off; owner-only, cache ezik-v100): app.js 2264726 -> 2265489 bytes, sha256 0c979c9a..51a4; index.html 155556.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3480897. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57068 bytes: the store name gained a digit).
  //   2026-10-13 -- Item 89 (arbaeen: the forty-two of alnawawiforty.com with their explanation and audio, replacing the fifty -- preview only): app.js 2265489 -> 2264873 bytes, sha256 508eccdd..30d0; index.html 155556.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3450889. arbaeen-footnotes.json LEFT CORE; arbaeen.json moved 67360 -> 47290; arbaeen-sharh.json (270547) joined IDLE last. CACHE untouched. THIS digest is re-cut LAST, at CR = 0 (sw.js 57328 bytes).
  //   2026-10-13 -- Item 86 (memorizer, phase 2: an ayah left with a word he did not say takes the owner back to it -- his word of 13 October; owner-only, cache ezik-v101): app.js 2265489 -> 2266883 bytes, sha256 1e255064..bc77; index.html 155556.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3482291. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57068 bytes).
  //   2026-10-13 -- Item 86 (memorizer, phase 2: «سمِّعني» holds the owner on an ayah until it is said -- his word of 13 October, 14:28; owner-only, cache ezik-v102): app.js 2266883 -> 2270124 bytes, sha256 48ece781..1c2d; index.html 155556.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3485532. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57068 bytes).
  //   2026-10-13 -- Item 86 (memorizer, phase 2: his own engine holds him too -- engine p2.5; his engine and the red of his experiment stay his alone whoever the memorizer is opened to; owner-only, cache ezik-v103): app.js 2270124 -> 2273096 bytes, sha256 33ca4593..5472; index.html 155556.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3488504. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57068 bytes).
  //   2026-10-13 -- Item 86 (memorizer, opened to everyone by the owner's word of 13 October, 18:44 -- his engine and his red stay his; cache ezik-v104): app.js 2273096 -> 2273401 bytes, sha256 6eb6083e..f28d; index.html 155556.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3488809. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57068 bytes).
  //   2026-10-13 -- Merge of origin/main 5540850e (item 86 v101-v102 + Kunuz) into item 89 (arbaeen): app.js rebuilt from the merged source, 2269508 bytes, sha256 361e951e..edb4; index.html 155556. CACHE ezik-v103.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3455524. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57328 bytes).
  //   2026-10-13 -- Merge of origin/main 8d8579b6 (item 86 phase 2 engine p2.5, cache ezik-v103; Hanna Laha picker) into item 89 (arbaeen): app.js rebuilt from the merged source, 2272480 bytes, sha256 f44e11fc..d6c0; index.html 155556. CACHE ezik-v104.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3458496. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57328 bytes).
  //   2026-10-13 -- Merge of origin/main d62e9e6c (item 89 arbaeen sharh, which took ezik-v104 too) into item 86 (memorizer opened to everyone): app.js rebuilt from the merged source, 2272785 bytes, sha256 efaf8d44..1760; index.html 155556. CACHE ezik-v105.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3458801. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57328 bytes).
  //   2026-10-14 -- Item 86 (memorizer, tajweed shown and never held: a word said right whose tajweed the owner's engine p2.8 heard otherwise is underlined; owner-only, cache ezik-v108): app.js 2272785 -> 2273423 bytes, sha256 e39c472c..fc15; index.html 155556.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3459437. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57328 bytes).
  //   2026-10-15 -- brain-line O1c (item 91, the answer log's tab in the owner's inbox): app.js 2273423 -> 2275229 bytes, sha256 12431963..eab4; CACHE untouched (ezik-v108).
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3461243. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57328 bytes).
  //   2026-10-15 -- brain-line H2 (item 74, the client's tag pattern reads the self-closing verse and hadith): app.js 2275229 -> 2275592 bytes, sha256 6e4f9a6e..1dd6; CACHE untouched (ezik-v108).
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3461606. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57328 bytes).
  //   item r2-3 (2026-10-17 brain-line R2): the status line through ezT, key x.658 in app.jsx and the 21 lang files: app.js 2275592 -> 2275953 bytes, sha256 11732417..dd0d; CACHE untouched (ezik-v108).
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3461967. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57328 bytes).
  //   2026-10-17 -- brain-line SHIP: cache ezik-v108 -> ezik-v109 (the owner's ship order of 17 October; config/app-version.json and sw.js CACHE, app.js line 6 rebuilt): app.js 2275953 -> 2275953 bytes, sha256 02f02efb..bd54; node tools/core-bytes.cjs --write: CORE_BYTES 3461967.
//                    NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57328 bytes).
  //   2026-10-18 -- Item 86 (memorizer: when the browser refused the page the owner's computer, the line under his bar says so and how to allow it, instead of 'the engine does not answer'; owner-only; new key mem86.ear.blocked in app.jsx and the 21 lang files; cache ezik-v109 -> ezik-v110): app.js 2275953 -> 2277568 bytes, sha256 ca400072..4f75; index.html 155556.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3463582. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57328 bytes).
  //   2026-10-18 -- about page: developer name and contact under the built-in-Kuwait line, rows x.659 and x.660 in app.jsx (ar, en) and the 21 lang files; cache ezik-v110 -> ezik-v111 (config/app-version.json and sw.js CACHE, sw.js prose app.js size): app.js 2277568 -> 2278440 bytes, sha256 96ab69ec..f31a; node tools/core-bytes.cjs --write: CORE_BYTES 3464454.
//                    NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57328 bytes).
  //   2026-10-19 -- merge 4K (A3): the About panel names the eleven new fatwa sources after the nineteen, each labelled as from the scholars' discs instead of a domain (app.jsx EZIK_SOURCES_SECTIONS sources.fatwa); CACHE untouched (ezik-v111): app.js 2278440 -> 2279271 bytes, sha256 7cdf305e..0359; node tools/core-bytes.cjs --write: CORE_BYTES 3465285.
//                    NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57328 bytes).
  //   2026-10-19 -- merge 4K ship: cache ezik-v111 -> ezik-v112 (the owner's word of 19 October; config/app-version.json and sw.js CACHE, app.js line 6 rebuilt): app.js 2279271 -> 2279271 bytes, sha256 0c18f7cc..6765; node tools/core-bytes.cjs --write: CORE_BYTES 3465285.
//                    NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57328 bytes).
  //   2026-10-21 -- ITEM 110 (Android layer back, range, archived plan, prose direction and done counter): app.js 2279271 -> 2282018 bytes, sha256 b4e9c55f..6199; index.html 155556.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3468032. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57328 bytes).
  //   2026-10-21 -- ITEM 110 (Android layer back, range, archived plan, prose direction and done counter): app.js 2282018 -> 2282005 bytes, sha256 9e198cd7..13e3; index.html 155556.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3468019. NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57328 bytes).
  //   2026-10-22 -- IAP-D sign-in return deep link: app.js 2282005 -> 2282367 bytes, sha256 173a08df..6a984; index.html 155556.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3468019 -> 3468381. NO CORE entry joined or left; the app.js line in sw.js's measured byte table followed. THIS digest is re-cut LAST, at CR = 0 (sw.js 57328 bytes).
  //   2026-10-24 -- POSTSHIP item 5, the answer-log tab chooses its day (app.jsx ezikAnswerLogDays and the day select): app.js 2282367 -> 2283553 bytes; index.html 155556.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3468381 -> 3469567. NO CORE entry joined or left; the app.js line in sw.js's measured byte table followed. THIS digest is re-cut LAST, at CR = 0.
  //   2026-10-24 -- POSTSHIP item 6, the book card draws «…» after a passage that stops mid-sentence (app.jsx BookCard, the open attribute): app.js 2283553 -> 2283924 bytes.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3469938. NO CORE entry joined or left; the app.js line in sw.js's measured byte table followed. THIS digest is re-cut LAST, at CR = 0.
  //   2026-10-24 -- POSTSHIP item 7, the client takes the server's ezik_replace frame (a refusal after streamed prose): app.js 2283924 -> 2284222 bytes.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3470236. NO CORE entry joined or left; the app.js line in sw.js's measured byte table followed. THIS digest is re-cut LAST, at CR = 0.
  //   2026-10-24 -- POSTSHIP item 6, the «…» of an open book passage moves to its own element after the passage (follow-up): app.js 2284222 -> 2284234 bytes.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3470248. NO CORE entry joined or left; the app.js line in sw.js's measured byte table followed. THIS digest is re-cut LAST, at CR = 0.
  //   2026-10-24 -- POSTSHIP item 9, the brief answer's fatwa excerpt and its «النص الكامل» button (app.jsx FatwaFullText): app.js 2284234 -> 2285652 bytes.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3471666. NO CORE entry joined or left; the app.js line in sw.js's measured byte table followed. THIS digest is re-cut LAST, at CR = 0.
  //   2026-10-25 -- POSTSHIP FIX2 item 2, BookCard draws one ellipsis under a cut passage: app.js 2285652 -> 2285658 bytes.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3471672. NO CORE entry joined or left; the app.js line in sw.js's measured byte table followed. THIS digest is re-cut LAST, at CR = 0.
  //   2026-10-25 -- POSTSHIP FIX3 item 1, the brief fatwa's full text in its excerpt's place: app.js 2285658 -> 2287921 bytes.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3473935. NO CORE entry joined or left; the app.js line in sw.js's measured byte table followed. THIS digest is re-cut LAST, at CR = 0.
  //   2026-10-25 -- POSTSHIP FIX4 item 1, every surface reading the answer knows the brief fatwa's <fatwafull> tag (copy, share, voice, log, previews, fold): app.js 2287921 -> 2290753 bytes.
//                    node tools/core-bytes.cjs --write: CORE_BYTES 3476767. NO CORE entry joined or left; the app.js line in sw.js's measured byte table followed. THIS digest is re-cut LAST, at CR = 0.
  //   2026-10-25 -- POSTSHIP SHIP: cache ezik-v112 -> ezik-v113 (the owner's word of 25 October; config/app-version.json and sw.js CACHE, app.js line 6 rebuilt): app.js 2290753 -> 2290753 bytes, sha256 3298fdaf..9b1c; node tools/core-bytes.cjs --write: CORE_BYTES 3476767.
//                    NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57328 bytes).
  //   2026-10-26 -- YAHIMMAK, the section «يهمّك» (yahimmak.json and yahimmak-book.json warm in IDLE, not CORE) and cache ezik-v113 -> ezik-v114: app.js 2290753 -> 2356171 bytes, sha256 f097839d..2de5; node tools/core-bytes.cjs --write: CORE_BYTES 3542185.
//                    NO FILE JOINED OR LEFT CORE. THIS digest is re-cut LAST, at CR = 0 (sw.js 57787 bytes).
  'sw.js': '206583f8e05627735c63b7d98a03aaaea09605693aad7ca2ed41df2978c15d04',
};

// ---------------------------------------------------------------------------
// B11: THE SERVICE WORKER'S DATA-FILE POLICY, EXECUTED.
//
// B10 proves sw.js has not moved. It cannot prove sw.js still BEHAVES. Item 80
// was exactly that gap: the data files were served cache-first with no
// revalidation, so a changed adhkar.json stayed frozen on every phone that had
// ever opened the app until a human remembered to bump the cache name below.
// A seal would have happily blessed that forever.
//
// So B11 runs the worker. sw.js is evaluated in vm.runInContext with `self`,
// `caches` and `fetch` domesticated -- the same technique the vendor-loading
// guards in this repo already use -- and a synthetic FetchEvent is dispatched
// at it. No browser, no network, no server: the assertions below are about what
// the code DOES, and they are written against the worker's own selector rather
// than against a line number, an index into the file, or a quoted source line.
//
// SW_CACHE is re-cut with the seal above, in the same commit, by whoever ships
// a version bump. It is here so that a forgotten bump fails with a sentence
// instead of with "sw.js MOVED".
// ---------------------------------------------------------------------------
const SW_FILE = 'sw.js';
// ITEM 106-B -- THE STORE NAME IS READ, NOT RETYPED. config/app-version.json is the one source of the
// version; sw.js's CACHE is the only other hand-written copy, and B11 below is what holds the two
// together: the worker must open exactly the store this file names.
const SW_CACHE = (() => {
  const v = JSON.parse(fs.readFileSync(path.join(__dirname, 'config', 'app-version.json'), 'utf8')).app_version;
  if (typeof v !== 'string' || !/^[A-Za-z0-9._-]{1,40}$/.test(v)) {
    throw new Error('config/app-version.json: app_version is not a usable store name: ' + JSON.stringify(v));
  }
  return v;
})();
const SW_ORIGIN = 'https://ezik.app';
// ITEM 93-B. The tag on the end-of-install brief the worker pushes to every client. Written here
// rather than read back out of sw.js, because "the worker sent whatever the worker calls it" is a
// tautology: a renamed tag would satisfy it while every listener in the app went deaf.
const SW_REPORT_TAG = 'precache-report';
// The data-file class item 80 governs, and one member of every class it must NOT
// have touched. Named by request, because the worker selects by request.
// ITEM 90 SPLIT THIS CLASS IN TWO, and each half is asserted for the OPPOSITE thing. The two
// mushaf files are sealed by digest above, so the worker excludes them from revalidation by name
// and serves them cache-first; the other three still revalidate. Asserting only the revalidating
// half would let the exclusion widen until it swallowed adhkar.json, which is precisely the
// freeze item 80 was raised to end. So: these three must issue exactly ONE background fetch, and
// those two must issue ZERO.
const SW_REVALIDATED = ['/adhkar.json', '/worship-display.json', '/manifest.json'];
// ITEM 91-A. What CORE must contain after a precache in the SANE state. Written out rather than
// read back from the worker, because "everything the worker chose to write was written" is a
// tautology: a CORE that quietly lost an entry would satisfy it. sw.js is sealed by digest
// above, so this list and that list are re-cut together or not at all.
// ITEM 32 ADDED THE LAST THREE. They are the files the first paint cannot happen without, and
// they are on this origin for the first time: /app.js is index.html's JSX compiled ahead of the
// commit, and the two /vendor bundles are the React the page used to fetch from unpkg. A CORE
// that stored the shell and not the app is what made "offline boot is not possible" true.
// ITEM 85 ADDED THE LAST TWO. They are the two Noto Naskh Arabic cuts the FIRST SCREEN pulls,
// self-hosted since the boot stopped waiting on Google for its type. A CORE that stored the app
// and not the face it is drawn in leaves an offline returning reader in the UA's fallback serif.
const SW_CORE = ['/', '/manifest.json', '/icon-192.png', '/icon-512.png',
  '/icon-maskable-512.png', '/icon-watermark.png', '/adhkar.json',
  '/adhkar-split-27.json', '/arbaeen.json', '/daily-tafsir.json',
  '/sunan-day.json',
  '/app.js', '/vendor/react.umd.js', '/vendor/react-dom.umd.js',
  '/fonts/RrQKbpV-9Dd1b1OAGA6M9PkyDuVBeN2DHV20Lg.woff2',
  '/fonts/RrQKbpV-9Dd1b1OAGA6M9PkyDuVBeN2GHV0.woff2',
  '/fonts/Iura6YBj_oCad4k1nzGBCw.woff2', '/fonts/Iurf6YBj_oCad4k1l8KiHrFpiQ.woff2',
  '/fonts/Iurf6YBj_oCad4k1l4qkHrFpiQ.woff2', '/fonts/Iurf6YBj_oCad4k1l5anHrFpiQ.woff2'];
// The files CORE names on disk, in the same order. B12 re-derives their byte sum and refuses a
// CORE_BYTES constant that has fallen below it.
const SW_CORE_FILES = ['index.html', 'manifest.json', 'icon-192.png', 'icon-512.png',
  'icon-maskable-512.png', 'icon-watermark.png', 'adhkar.json', 'adhkar-split-27.json',
  'arbaeen.json', 'daily-tafsir.json', 'sunan-day.json',
  'app.js', 'vendor/react.umd.js', 'vendor/react-dom.umd.js',
  'fonts/RrQKbpV-9Dd1b1OAGA6M9PkyDuVBeN2DHV20Lg.woff2',
  'fonts/RrQKbpV-9Dd1b1OAGA6M9PkyDuVBeN2GHV0.woff2',
  // ITEM 74. The four Latin faces of Tajawal: the English interface is read offline from the cache.
  'fonts/Iura6YBj_oCad4k1nzGBCw.woff2', 'fonts/Iurf6YBj_oCad4k1l8KiHrFpiQ.woff2',
  'fonts/Iurf6YBj_oCad4k1l4qkHrFpiQ.woff2', 'fonts/Iurf6YBj_oCad4k1l5anHrFpiQ.woff2'];
const SW_SEALED_DATA = ['/quran-uthmani.json', '/mushaf-layout.json'];
// ITEM 33. The store the 604 printed page scans live in, and the ceiling on it. Written out
// here rather than read back out of sw.js for the same reason SW_CORE and SW_REPORT_TAG are:
// "the worker capped it at whatever the worker calls the cap" is a tautology that a cap
// silently raised to 10000 would satisfy. sw.js is sealed by digest above, so this pair and
// that pair are re-cut together or not at all.
const SW_MUSHAF_CACHE = 'ezik-mushaf-pages-v1';
const SW_MUSHAF_CAP = 60;
// The URL is COMPUTED, exactly as index.html computes it: 604 literal paths would be a table
// nobody reads and a second place for the naming scheme to drift.
const swPageUrl = (n) => '/assets/madina-hafs/page-' + String(n).padStart(3, '0') + '.webp';
const SW_DATA_FILES = SW_REVALIDATED.concat(SW_SEALED_DATA);

// ITEM 91-A. The synthetic rejections the harness can hand a `cache.add`. A full disk and a
// dead network must be told apart by the worker itself, so they arrive with the identities a
// real browser gives them: QuotaExceededError carries its name, a failed fetch carries a
// TypeError whose text names the fetch.
function swAddError(kind) {
  const e = new Error(kind === 'network'
    ? 'Failed to fetch (synthetic)'
    : 'QuotaExceededError: quota exceeded (synthetic)');
  e.name = kind === 'network' ? 'TypeError' : 'QuotaExceededError';
  return e;
}

// A domesticated navigator.storage. `estimate:false` / `persist:false` remove that method
// entirely, which is how the old-browser state is expressed -- as an ABSENT function rather
// than as one that returns something odd.
function swNav(opts) {
  const calls = { estimate: 0, persist: 0 };
  const storage = {};
  if (opts.estimate !== false) {
    storage.estimate = () => {
      calls.estimate++;
      return Promise.resolve({ quota: opts.quota, usage: opts.usage });
    };
  }
  if (opts.persist !== false) {
    storage.persist = () => {
      calls.persist++;
      if (opts.persist === 'throws') return Promise.reject(new Error('not allowed'));
      return Promise.resolve(opts.persist !== 'denied');
    };
  }
  return { navigator: { storage: storage }, calls: calls };
}

function swRes(body, status) {
  return {
    status: status === undefined ? 200 : status,
    type: 'basic',
    _body: body,
    clone() { return swRes(this._body, this.status); },
    text() { return Promise.resolve(this._body); },
  };
}

// ITEM 93-B. A domesticated `self.clients`. The worker reaches the page through matchAll +
// postMessage, so both have to be levers a test can move: how many pages are listening (0 is a
// real state, and the commonest one on a first install), whether one of them throws on
// postMessage, and whether the browser exposes matchAll at all.
function swClients(opts) {
  const o = opts || {};
  const posted = [];
  const calls = [];
  const count = typeof o.count === 'number' ? o.count : 1;
  const clients = { claim: () => Promise.resolve() };
  if (o.matchAll !== false) {
    clients.matchAll = (arg) => {
      calls.push(arg || null);
      if (o.matchAll === 'rejects') return Promise.reject(new Error('no clients (synthetic)'));
      const list = [];
      for (let i = 0; i < count; i++) {
        const id = 'c' + i;
        list.push({
          id: id,
          postMessage: (m) => {
            if (o.throwsOn === id) throw new Error('client is gone (synthetic)');
            posted.push({ client: id, message: m });
          },
        });
      }
      return Promise.resolve(list);
    };
  }
  return { clients: clients, posted: posted, calls: calls };
}

// Load sw.js into a domesticated global scope and hand back the levers a test needs.
// ITEM 33 added the last two parameters. `failPut` makes a runtime cache.put reject, which is
// the only way to ask the worker what it does with a page write it cannot prevent failing --
// the question item 93 asked of PRECACHE entries and never asked of these. cache.keys() had to
// become real because the page store's least-recently-used order is seeded from it.
function swLoad(swPath, fetchImpl, failAdd, nav, clientsOpt, failPut) {
  const store = new Map();
  const listeners = {};
  const opened = [];
  // ITEM 91-A: what the worker DELETED and what it ATTEMPTED to add. Both are behaviour, and
  // both are invisible to a harness whose `add` neither stores nor records.
  const deleted = [];
  const addCalls = [];
  const clientHarness = swClients(clientsOpt);
  let fetchCalls = 0;
  const keyOf = (r) => (typeof r === 'string' ? SW_ORIGIN + r : r.url);
  const cacheOf = (n) => { if (!store.has(n)) store.set(n, new Map()); return store.get(n); };
  const wrap = (n) => ({
    match: (r) => Promise.resolve(cacheOf(n).get(keyOf(r))),
    put: (r, res) => {
      const kind = failPut && failPut(keyOf(r));
      if (kind) return Promise.reject(swAddError(kind === true ? 'quota' : String(kind)));
      cacheOf(n).set(keyOf(r), res);
      return Promise.resolve();
    },
    // A real cache.keys() answers in INSERTION order, and the page store's eviction order is
    // seeded from exactly that. A Map preserves insertion order, so this is the real contract
    // and not an approximation of it.
    keys: () => Promise.resolve(Array.from(cacheOf(n).keys()).map((u) => ({ url: u }))),
    // Item 93: the harness can make a named precache entry reject, which is the only way to ask
    // the worker what it does with a failure it cannot prevent.
    // ITEM 91-A: `failAdd` is now handed the eviction log too, so a test can express "this
    // write fails UNTIL room has been made" -- the only shape in which a retry can be
    // distinguished from a write that was always going to succeed. A successful add now WRITES,
    // because "was CORE actually stored" is the acceptance condition of the whole item.
    add: (u) => {
      addCalls.push(u);
      const kind = failAdd && failAdd(u, { deleted: deleted.slice(), adds: addCalls.length });
      if (kind) return Promise.reject(swAddError(kind === true ? 'quota' : String(kind)));
      cacheOf(n).set(keyOf(u), swRes('ADDED ' + u));
      return Promise.resolve();
    },
    delete: (r) => Promise.resolve(cacheOf(n).delete(keyOf(r))),
  });
  const sandbox = {
    URL: URL, Promise: Promise, setTimeout: setTimeout, clearTimeout: clearTimeout, console: console,
    self: {
      addEventListener: (t, f) => { listeners[t] = f; },
      skipWaiting: () => {},
      clients: clientHarness.clients,
      location: { origin: SW_ORIGIN },
    },
    caches: {
      // A real caches.open() CREATES the cache, so caches.keys() lists it from that moment.
      // Returning a lazy handle instead hid the current store from every keys() call until the
      // first successful write -- and an eviction that deletes the current store is exactly what
      // that window made invisible. B12 M2 escaped on this and nothing else.
      open: (n) => { opened.push(n); cacheOf(n); return Promise.resolve(wrap(n)); },
      match: (r) => {
        for (const n of store.keys()) {
          const h = cacheOf(n).get(keyOf(r));
          if (h) return Promise.resolve(h);
        }
        return Promise.resolve(undefined);
      },
      keys: () => Promise.resolve(Array.from(store.keys())),
      delete: (n) => { deleted.push(n); return Promise.resolve(store.delete(n)); },
    },
    fetch: (r) => { fetchCalls++; return fetchImpl(r); },
    // ITEM 91-A. Left UNDEFINED unless a test supplies one: `typeof navigator === 'undefined'`
    // then holds inside the worker, which is the old-browser state exactly as a phone has it.
    navigator: nav,
  };
  vm.runInContext(fs.readFileSync(swPath, 'utf8'), vm.createContext(sandbox), { filename: swPath });
  return {
    hasFetchListener: () => typeof listeners.fetch === 'function',
    opened: opened,
    fetches: () => fetchCalls,
    seed: (name, url, body) => cacheOf(name).set(SW_ORIGIN + url, swRes(body)),
    peek: (name, url) => {
      const h = cacheOf(name).get(SW_ORIGIN + url);
      return h ? h._body : undefined;
    },
    self: sandbox.self,
    // ITEM 93-B levers: what the worker HANDED the pages, and what it asked for when it looked
    // them up. Both are behaviour; neither is visible in the cache or the storage record.
    posted: () => clientHarness.posted.slice(),
    matchAllCalls: () => clientHarness.calls.slice(),
    // ITEM 91-A levers.
    storage: () => sandbox.self.ezikStorage,
    deleted: () => deleted.slice(),
    adds: () => addCalls.slice(),
    stores: () => Array.from(store.keys()),
    has: (name, url) => cacheOf(name).has(SW_ORIGIN + url),
    seedStore: (name) => { cacheOf(name); },
    activate: () => {
      const waits = [];
      if (typeof listeners.activate !== 'function') return { waits: waits, missing: true };
      listeners.activate({ waitUntil: (p) => { waits.push(p); } });
      return { waits: waits, missing: false };
    },
    install: () => {
      const waits = [];
      if (typeof listeners.install !== 'function') return { waits: waits, missing: true };
      listeners.install({ waitUntil: (p) => { waits.push(p); } });
      return { waits: waits, missing: false };
    },
    // A-4: the pull channel, driven. The worker answers 'precache-status' on the port the
    // page hands it, and that reply is the ONLY place the page can learn the store's ceiling
    // and its floor -- so it is behaviour, and it is tested rather than assumed.
    message: (data) => {
      if (typeof listeners.message !== 'function') return { missing: true, reply: null };
      let reply = null;
      listeners.message({
        data: data,
        ports: [{ postMessage: (m) => { reply = m; } }],
        waitUntil: () => {},
      });
      return { missing: false, reply: reply };
    },
    dispatch: (url, mode) => {
      let responded = null;
      const waits = [];
      listeners.fetch({
        request: { url: SW_ORIGIN + url, method: 'GET', mode: mode || 'cors' },
        respondWith: (p) => { responded = p; },
        waitUntil: (p) => { waits.push(p); },
      });
      return { responded: responded, waits: waits };
    },
  };
}

const swSettle = (ps) => Promise.all(ps.map((p) => Promise.resolve(p).catch(() => undefined)));
// The reason on the one record a B12 state produced, or a sentence naming what it found instead.
// Never an empty string: a blank would satisfy every negative check that reads it.
const mineReason = (rec) => (rec.length === 1 && rec[0] && rec[0].reason !== undefined
  ? rec[0].reason
  : '(' + rec.length + ' record(s), no single reason)');
const swBody = async (p) => {
  if (!p) return undefined;
  const r = await Promise.resolve(p).catch(() => undefined);
  return r ? await r.text() : undefined;
};

// ---------------------------------------------------------------------------
// ITEM 10: the Kunuz bank, read the way a browser reads it -- one classic script that
// declares a global DATA -- in a vm with nothing else in scope.
// ---------------------------------------------------------------------------
function loadKunuzBank(p) {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: p });
  return ctx.DATA;
}
const countOf = (hay, needle) => hay.split(needle).length - 1;


// The lab header is shared by every mode. Execute its shipped script with a local
// DOM and stored boot data; no browser, network, new store or copied action code.
async function assertMushafTopbar(html, source, css) {
  const { parseHTML } = require('linkedom');
  const assert = require('assert/strict');
  let checks = 0;
  const check = (condition, label) => { assert.ok(condition, label); checks++; };
  const removed = ['prevBtn', 'nextBtn', 'surahTitle', 'subTitle', 'notice'];
  function header(document) {
    const bars = document.querySelectorAll('header.top');
    check(bars.length === 1, 'one shared lab header');
    const top = bars[0], buttons = [...top.querySelectorAll('button')];
    check(top.textContent.trim() === '', 'no visible text among the six removed header elements');
    check(buttons.map(b => b.id).join(',') === 'exitBtn,pageBookmarkBtn', 'one bookmark toggle and KEEP_BACK_ARROW=yes');
    check(removed.every(id => !document.getElementById(id)), 'removed nodes absent in every mode');
    check(buttons.every(b => b.getAttribute('aria-label') && b.querySelector('svg[aria-hidden="true"]')), 'icons have accessible names');
    check(buttons.every(b => b.querySelector('svg').getAttribute('width') === '24'
      && b.querySelector('svg').getAttribute('height') === '24'), '24px icons');
    check(buttons[0].querySelector('path').getAttribute('d') === 'M9 18l6-6-6-6', 'back points right in RTL');
    check(top.querySelectorAll('[aria-pressed]').length === 1, 'only bookmark is a toggle');
    return buttons[1];
  }
  header(parseHTML(html).document);
  check(removed.every(id => !new RegExp("\\$\\(['\"]" + id + "['\"]\\)").test(source)), 'no script writes into removed nodes');
  check(!/<header\b|createElement\(['"]header['"]\)/.test(source), 'script does not create an alternative header');
  check(/height:\s*calc\(44px \+ var\(--sat\)\)/.test(css), '44px header plus top safe area');
  check(/\.top \.ib \{[^}]*width:\s*44px;[^}]*height:\s*44px/.test(css), '44px touch targets');
  check(/#pageBookmarkBtn \{ margin-inline-start: auto; \}/.test(css), 'bookmark is at inline end');
  check(/#pageBookmarkBtn\[aria-pressed="true"\] svg \{ fill: currentColor; \}/.test(css), 'saved bookmark is filled');
  const wire = source.match(/function wire\(\) \{[\s\S]*?\n  \}/);
  const action = source.match(/function savedAction\(b\) \{[\s\S]*?\n  \}/);
  check(wire && action && /togglePageBookmark\(\)/.test(wire[0])
    && /act === 'bmPage'[^\n]*togglePageBookmark\(\)/.test(action[0]), 'bar and saved tab call the same page action');
  check(/function togglePageBookmark\(\) \{[\s\S]*?toggleBookmark\('p', cur\)/.test(source), 'shared action calls the existing page bookmark store');

  const bootFiles = {};
  for (const f of ['mushaf-lab/data/tables.json', 'mushaf-lab/data/meta.json', 'mushaf-layout.json', 'quran-uthmani.json']) {
    bootFiles['/' + f] = JSON.parse(fs.readFileSync(path.join(__dirname, f), 'utf8'));
  }
  async function load(options = {}) {
    const dom = parseHTML(html), document = dom.document;
    const storage = new Map([
      ['lab.settings', JSON.stringify({ theme: options.theme || 'light', mode: options.mode || 'print', spread: true })],
      ['lab.bm', JSON.stringify(options.saved || [])], ['lab.hintSeen', 'true']
    ]);
    const messages = [], events = {}, timers = new Map(), errors = [];
    let nextTimer = 0, fetches = 0;
    const location = { origin: 'https://lab.invalid', pathname: '/mushaf-lab/index.html', hash: options.hash || '#p=3', href: 'https://lab.invalid/mushaf-lab/index.html' };
    const window = {
      document, location, innerWidth: options.width || 390, innerHeight: 844,
      matchMedia: () => ({ matches: (options.width || 390) <= 700 }),
      getComputedStyle: () => ({ paddingTop: '0', paddingBottom: '0' }),
      addEventListener: (type, fn) => { events[type] = fn; }
    };
    window.self = window;
    window.parent = options.standalone ? window : { document, getComputedStyle: window.getComputedStyle,
      postMessage: (message, origin) => messages.push({ message, origin }) };
    window.top = window.parent;
    const context = {
      window, document, location, navigator: { onLine: !options.offline }, URL, URLSearchParams,
      console: { log() {}, warn() {}, error: e => errors.push(String(e)) },
      Audio: class { addEventListener() {} pause() {} play() { return Promise.resolve(); } },
      localStorage: { getItem: key => storage.has(key) ? storage.get(key) : null, setItem: (key, value) => storage.set(key, value) },
      setTimeout: (fn, ms) => { timers.set(++nextTimer, { fn, ms }); return nextTimer; },
      clearTimeout: id => timers.delete(id),
      fetch: async url => {
        fetches++;
        if (options.error) throw new Error('offline with no boot data');
        const key = new URL(url, location.href).pathname, data = bootFiles[key];
        return { ok: !!data, json: async () => data };
      }
    };
    vm.runInNewContext(source, context, { timeout: 3000 });
    header(document); // Includes the loading state before the boot promises settle.
    await new Promise(resolve => setImmediate(resolve));
    const button = header(document), lab = window.__lab;
    const click = node => node.dispatchEvent(new dom.window.Event('click', { bubbles: true }));
    const event = (type, props = {}) => Object.assign(new dom.window.Event(type, { bubbles: true }), props);
    return { document, window, storage, messages, events, timers, button, lab, click, event, errors, fetches: () => fetches };
  }

  const h = await load({ offline: true });
  const saved = () => JSON.parse(h.storage.get('lab.bm'));
  const pressed = () => h.button.getAttribute('aria-pressed');
  check(h.document.getElementById('loading').hidden && !h.button.disabled, 'cached offline boot enables toggle');
  check(pressed() === 'false' && h.button.querySelector('svg').getAttribute('fill') === 'none', 'unsaved page opens with outline');
  h.lab.savedSheet('bm');
  let bubbled = 0;
  h.document.addEventListener('click', () => { bubbled++; });
  const beforeFetch = h.fetches();
  h.click(h.button);
  check(saved().length === 1 && saved()[0].t === 'p' && saved()[0].k === 3, 'top toggle saves the current page');
  check(Object.keys(saved()[0]).sort().join(',') === 'at,id,k,t,tags', 'existing bookmark record shape');
  check(pressed() === 'true' && h.document.querySelector('[data-bmdel]'), 'saved list and pressed state update immediately');
  check(h.messages.some(x => x.message.type === 'mushaf-lab:bookmark' && x.message.page === 3
    && x.origin === 'https://lab.invalid'), 'existing bookmark bridge is called');
  check(bubbled === 0 && !h.document.body.classList.contains('immersive') && h.lab.state.cur === 3, 'icon tap neither bubbles nor hides bars nor turns page');
  check(h.fetches() === beforeFetch, 'bookmark tap makes zero network requests');
  h.click(h.document.querySelector('[data-bmdel]'));
  check(saved().length === 0 && pressed() === 'false', 'list removal updates the top icon');
  h.click(h.document.getElementById('toastAct'));
  check(saved().length === 1 && pressed() === 'true', 'undo updates the top icon');
  h.click(h.button);
  check(saved().length === 0 && !h.document.querySelector('[data-bmdel]') && pressed() === 'false', 'top toggle removes and refreshes list');
  h.click(h.document.querySelector('[data-act="bmPage"]'));
  check(saved().length === 1 && pressed() === 'true', 'existing saved-tab page action updates icon');
  check(h.button.getAttribute('aria-label') === h.document.querySelector('[data-act="bmPage"]').textContent, 'existing Arabic page label is reused');

  h.lab.goPage(4); check(pressed() === 'false', 'go-to changes bookmark state');
  h.lab.goPage(3); check(pressed() === 'true', 'return restores bookmark state');
  h.lab.turn(1, true); h.document.getElementById('spread').dispatchEvent(h.event('transitionend'));
  check(h.lab.state.cur === 4 && pressed() === 'false', 'swipe commit changes state');
  h.document.dispatchEvent(h.event('keydown', { key: 'ArrowRight' }));
  h.document.getElementById('spread').dispatchEvent(h.event('transitionend'));
  check(h.lab.state.cur === 3 && pressed() === 'true', 'keyboard previous still works without buttons');
  h.window.location.hash = '#p=5'; h.events.hashchange();
  check(h.lab.state.cur === 5 && pressed() === 'false', 'hash route changes state');
  h.window.innerWidth = 1200; h.lab.goPage(4); h.click(h.button);
  check(h.lab.visiblePages(4).join(',') === '3,4' && saved().some(b => b.t === 'p' && b.k === 4)
    && h.document.getElementById('navPage').textContent === '\u0664', 'spread bookmark uses the bottom-bar anchor');
  h.click(h.document.getElementById('exitBtn'));
  check(h.messages.some(x => x.message.type === 'mushaf-lab:exit'), 'back retains the parent exit message');
  check([...h.storage.keys()].every(k => ['lab.settings', 'lab.bm', 'lab.hintSeen', 'lab.last', 'lab.recent'].includes(k)), 'no new storage key');
  check(h.errors.length === 0, 'no console errors');

  for (const options of [
    { saved: [{ id: 'existing', t: 'p', k: 3, tags: [], at: 1 }] },
    { theme: 'dark', width: 412 }, { mode: 'vector' }, { standalone: true },
    { hash: '#s=2' }, { hash: '#a=2:1' }, { hash: '#saved' }, { hash: '#last' }, { error: true }
  ]) {
    const variant = await load(options);
    check(variant.errors.length === 0, 'variant has no console errors');
    if (options.saved) check(variant.button.getAttribute('aria-pressed') === 'true', 'saved page is pressed on opening');
    if (options.error) check(variant.button.disabled && !variant.document.getElementById('loading').hidden, 'error path keeps the one inert bookmark control');
    else check(variant.document.getElementById('exitBtn').hidden === !!options.standalone, 'existing embedded-only back visibility');
  }
  return checks;
}

async function compare(bankPath) {
  let pass = 0, fail = 0;
  const ok = m => { pass++; console.log('  PASS ' + m); };
  const no = (c, m) => { fail++; console.log('  FAIL [' + c + '] ' + m); };

  // -- K1 the shared bank ------------------------------------------------
  console.log('\n-- K1 the shared Kunuz bank --');
  if (path.normalize(bankPath) !== path.normalize(BANK)) no('K1', 'the gate was pointed at ' + bankPath + ', not ' + BANK);
  let D = null;
  try { D = loadKunuzBank(path.join(__dirname, BANK)); } catch (e) { no('K1', BANK + ' does not evaluate: ' + (e && e.message)); }
  if (D && Array.isArray(D.qs) && Array.isArray(D.cats)) {
    if (D.qs.length === BANK_QUESTIONS) ok('question count = ' + BANK_QUESTIONS);
    else no('K1', 'question count = ' + D.qs.length + ' (accepted at ' + BANK_QUESTIONS + ')');
    if (D.cats.length === BANK_CATEGORIES) ok('category count = ' + BANK_CATEGORIES);
    else no('K1', 'category count = ' + D.cats.length + ' (accepted at ' + BANK_CATEGORIES + ')');
    let shape = 0;
    const ids = new Set(), perCat = D.cats.map(() => 0);
    let retiredN = 0, liveN = 0;
    D.qs.forEach((q, i) => {
      const at = 'question ' + i;
      if (!Array.isArray(q) || q.length !== 9) { shape++; no('K1', at + ' is not the nine-field shape'); return; }
      // a retired row: exactly [cat, 0, 0, '', [], -1, '', '', id], its id named in RETIRED, its category still in range
      if (q[2] === 0) {
        retiredN++;
        if (QUALITY_HELD[q[8]]) {
          const digest = crypto.createHash('sha256').update(JSON.stringify(q)).digest('hex');
          if (digest !== QUALITY_HELD[q[8]]) { shape++; no('K1', at + ' quality-held content changed: ' + q[8]); }
        } else {
          if (!RETIRED.has(q[8])) { shape++; no('K1', at + ' is retired but not named: ' + q[8]); }
          if (!Number.isInteger(q[0]) || q[0] < 0 || q[0] >= D.cats.length || q[1] !== 0 || q[3] !== '' || !Array.isArray(q[4]) || q[4].length || q[5] !== -1 || q[6] !== '' || q[7] !== '') { shape++; no('K1', at + ' is retired but not the blank shape'); }
        }
        if (ids.has(q[8])) { shape++; no('K1', at + ' repeats id ' + q[8]); } else ids.add(q[8]);
        return;
      }
      liveN++;
      if (q[1] !== 0 || q[2] !== 1) { shape++; no('K1', at + ' fields 1/2 are ' + q[1] + '/' + q[2] + ' (live is 0/1, retired is 0/0)'); }
      if (RETIRED.has(q[8]) || QUALITY_HELD[q[8]]) { shape++; no('K1', at + ' is named held but still live: ' + q[8]); }
      if (!Number.isInteger(q[0]) || q[0] < 0 || q[0] >= D.cats.length) { shape++; no('K1', at + ' category ' + q[0] + ' out of range'); }
      else perCat[q[0]]++;
      if (typeof q[3] !== 'string' || !q[3].trim()) { shape++; no('K1', at + ' has no stem'); }
      const o = q[4];
      if (!Array.isArray(o) || o.length < 3 || o.length > 4) { shape++; no('K1', at + ' does not offer 3..4 options'); }
      else {
        if (o.some((x) => typeof x !== 'string' || !x.trim())) { shape++; no('K1', at + ' has an empty option'); }
        if (new Set(o.map((x) => String(x).trim())).size !== o.length) { shape++; no('K1', at + ' repeats an option'); }
        if (!Number.isInteger(q[5]) || q[5] < 0 || q[5] >= o.length) { shape++; no('K1', at + ' key ' + q[5] + ' out of range'); }
      }
      if (typeof q[8] !== 'string' || !q[8]) { shape++; no('K1', at + ' has no id'); }
      else if (ids.has(q[8])) { shape++; no('K1', at + ' repeats id ' + q[8]); }
      else ids.add(q[8]);
    });
    if (retiredN === RETIRED.size + Object.keys(QUALITY_HELD).length) ok('the ' + retiredN + ' named held rows remain in place, never live; legacy blanks and quality-held original content verified');
    else no('K1', 'retired rows = ' + retiredN + ' (named ' + (RETIRED.size + Object.keys(QUALITY_HELD).length) + '): a retired row was deleted, which drops every player record');
    if (liveN === BANK_LIVE) ok('live questions = ' + BANK_LIVE); else no('K1', 'live questions = ' + liveN + ' (accepted at ' + BANK_LIVE + ')');
    // the pages' own stamp formula (count + FNV-1a of the ids in order) over the first BANK_PREFIX rows
    let h = 2166136261;
    for (let i = 0; i < BANK_PREFIX && i < D.qs.length; i++) { const q = D.qs[i], t = String(q.length > 8 ? q[8] : q[3]) + '\n'; for (let j = 0; j < t.length; j++) h = Math.imul(h ^ t.charCodeAt(j), 16777619) >>> 0; }
    const pre = BANK_PREFIX + '-' + ('0000000' + h.toString(16)).slice(-8);
    if (pre === BANK_PREFIX_STAMP) ok('the old ' + BANK_PREFIX + ' ids are an unchanged prefix (stamp ' + pre + '): every no-repeat record is carried');
    else no('K1', 'the stamp of the first ' + BANK_PREFIX + ' rows is ' + pre + ', not ' + BANK_PREFIX_STAMP + ': an old row moved or left, and every player record would be dropped');
    const empty = perCat.map((n, i) => (n ? -1 : i)).filter((i) => i > -1);
    if (empty.length) { shape++; no('K1', 'categories with no question: ' + empty.join(', ')); }
    if (!shape) ok('all ' + D.qs.length + ' questions are well-formed, ids unique, no empty category');
  } else if (D) no('K1', BANK + ' evaluated, but DATA has no qs/cats arrays');

  // -- K6 the bank's own rules: four options, no true/false, the entity rule ------
  // The Arabic is built from code points: this file stays ASCII (esc.cjs).
  console.log('\n-- K6 the bank rules --');
  if (D && Array.isArray(D.qs)) {
    const cp = (...a) => String.fromCharCode(...a);
    const strip = new RegExp('[' + cp(0x64B) + '-' + cp(0x65F) + cp(0x670) + cp(0x640) + ']', 'g');
    const A = '[' + cp(0x623, 0x625, 0x627) + ']';
    const israel = new RegExp(A + cp(0x633, 0x631, 0x627, 0x626, 0x64A, 0x644) + '|' + cp(0x635, 0x647, 0x64A, 0x648, 0x646) + '|' + cp(0x62A, 0x644) + ' +' + A + cp(0x628, 0x64A, 0x628) + '|israel|' + cp(92) + '.il' + cp(92) + 'b', 'i');
    const bani = new RegExp('(' + cp(0x628, 0x646, 0x64A) + '|' + cp(0x628, 0x646, 0x648) + '|' + cp(0x628, 0x646, 0x649) + ') +' + A + cp(0x633, 0x631, 0x627, 0x626, 0x64A, 0x644), 'g');
    // Named by id, and nothing else: the Prophet Yaqub question (Israel is his name), and the two
    // questions about Sultan Abdul Hamid II (the Zionist movement he refused). Owner rule 2026-10-13.
    const NAMED = new Set(['gemini-prophets-b3-008', 'gemini2-ottoman-005', 'othman-0013']);
    const FLOOR = 3145; // the first 3145 questions are the accepted bank; some of them offer three options
    const tfWord = new RegExp('^(' + cp(0x635, 0x62D) + '|' + cp(0x635, 0x62D, 0x64A, 0x62D) + '|' + cp(0x62E, 0x637, 0x623) + '|' + cp(0x62E, 0x627, 0x637, 0x626) + '|true|false)$', 'i');
    let four = 0, tf = 0, ent = 0;
    D.qs.forEach((q, i) => {
      if (q[2] === 0) return;   // a retired row has no content to rule on (K1 holds its shape)
      if (i >= FLOOR && (!Array.isArray(q[4]) || q[4].length !== 4)) { four++; no('K6', q[8] + ' does not offer exactly four options'); }
      if (Array.isArray(q[4]) && q[4].length && q[4].every((o) => tfWord.test(String(o).replace(strip, '').trim()))) { tf++; no('K6', q[8] + ' is a true/false question'); }
      if (NAMED.has(q[8])) return;
      const text = [q[3]].concat(q[4] || [], [q[6], q[7]]).join(' | ').replace(strip, '').replace(bani, '');
      if (israel.test(text)) { ent++; no('K6', q[8] + ' names the entity (owner rule): review it, do not delete it silently'); }
    });
    if (!four) ok('every question after the accepted ' + FLOOR + ' offers exactly four options');
    if (!tf) ok('no true/false question');
    if (!ent) ok('the entity rule holds over all ' + D.qs.length + ' questions (' + NAMED.size + ' named exceptions)');
    const present = [...NAMED].filter((id) => D.qs.some((q) => q[8] === id)).length;
    if (present === NAMED.size) ok('the named exceptions are still in the bank'); else no('K6', 'a named exception left the bank: ' + (NAMED.size - present));
  }

  // -- K2 one copy of the bank -----------------------------------------------
  console.log('\n-- K2 one copy --');
  const qd = fs.readdirSync(path.join(__dirname, 'quest-data')).sort();
  // KUNUZ-LEVELS-POETRY (2026-10-19, C): the bank and the experimental levels file (a map id -> level, no question in it)
  // The visual engine adds local geometry and a manifest, never another bank.
  // Disabled packs stay on disk for review and rollback.
  const QD = [path.basename(BANK), 'kunuz-levels-3147.js', 'kunuz-geo.js', 'kunuz-geo-index.js', 'kunuz-packs-manifest.js', 'kunuz-pack-landmark-draw.js', 'kunuz-pack-occasions-calendar.js'];
  const packs = new Function(fs.readFileSync(path.join(__dirname, 'quest-data', 'kunuz-packs-manifest.js'), 'utf8') + ';return KUNUZ_PACKS;')();
  if (!Array.isArray(packs)) no('K2', 'pack manifest is not an array');
  else for (const p of packs) {
    if (!p || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(p.slug) || p.src !== 'quest-data/kunuz-pack-' + p.slug + '.js') no('K2', 'invalid supplemental pack path');
    else QD.push(path.basename(p.src));
  }
  const signs = path.join(__dirname, 'quest-data', 'signs');
  if (fs.existsSync(signs)) {
    QD.push('signs');
    if (fs.readdirSync(signs).some(f => !/^[a-z0-9]+(?:-[a-z0-9]+)*\.webp$/.test(f))) no('K2', 'sign assets must be local WebP files');
  }
  QD.sort();
  if (qd.join() === QD.join()) ok('quest-data/ holds one bank, levels and declared visual sidecars: ' + qd.join(', '));
  else no('K2', 'quest-data/ holds [' + qd.join(', ') + '] -- expected only ' + QD.join(', '));
  { const lvt = fs.readFileSync(path.join(__dirname, 'quest-data', 'kunuz-levels-3147.js'), 'utf8');
    if (!/^var KUNUZ_LEVELS=\{"stamp":"[0-9]+-[0-9a-f]{8}","levels":\{("[A-Za-z0-9-]+":[123],?)+\}\};$/.test(lvt)) no('K2', 'the levels file is not a plain id -> level map');
    else ok('the levels file is a plain id -> level map, no question text in it'); }
  const embedders = fs.readdirSync(__dirname).filter((f) => /\.html$/.test(f))
    .filter((f) => fs.readFileSync(path.join(__dirname, f), 'utf8').indexOf('var DATA=') > -1);
  if (!embedders.length) ok('no root page embeds a bank of its own');
  else no('K2', 'pages embedding their own bank: ' + embedders.join(', '));

  // -- K3 the two modes ------------------------------------------------------
  console.log('\n-- K3 the two modes --');
  for (const f of KUNUZ_MODES) {
    const p = path.join(__dirname, f);
    if (!fs.existsSync(p)) { no('K3', f + ' is ABSENT'); continue; }
    const h = fs.readFileSync(p, 'utf8');
    if (countOf(h, BANK_TAG) === 1) ok(f + ' loads the shared bank exactly once');
    else no('K3', f + ' loads the shared bank ' + countOf(h, BANK_TAG) + ' times');
    if (/<a\b[^>]*href="\/quest\.html"/.test(h)) ok(f + ' carries the way back to /quest.html');
    else no('K3', f + ' has no link back to /quest.html');
    if (/<a\b[^>]*href="\/"/.test(h)) ok(f + ' carries the way home to /');
    else no('K3', f + ' has no link home to /');
  }

  // -- K4 the hub ------------------------------------------------------------
  console.log('\n-- K4 the hub --');
  {
    const h = fs.existsSync(path.join(__dirname, KUNUZ_HUB)) ? fs.readFileSync(path.join(__dirname, KUNUZ_HUB), 'utf8') : '';
    if (!h) no('K4', KUNUZ_HUB + ' is ABSENT');
    else {
      if (/<a\b[^>]*href="\/"/.test(h)) ok('the hub carries the home link to /');
      else no('K4', 'the hub has no home link to /');
      for (const f of KUNUZ_MODES) {
        if (h.indexOf('href="/' + f + '"') > -1) ok('the hub opens ' + f);
        else no('K4', 'the hub has no door to ' + f);
      }
      if (h.indexOf(BANK) === -1) ok('the hub does not load the bank');
      else no('K4', 'the hub loads the bank -- a door page must stay light');
    }
  }

  // -- K5 the app's entry ----------------------------------------------------
  console.log('\n-- K5 the entry from the app --');
  {
    const app = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
    const n = countOf(app, "window.location.href='/quest.html'");
    if (n > 0) ok('app.js still enters the treasure at /quest.html (' + n + ' sites)');
    else no('K5', 'app.js no longer navigates to /quest.html -- the hub is unreachable from the app');
  }

  // -- B10 the sealed files --------------------------------------------------
  // No `if git`, no `try`. Every file is opened and hashed on every run, and the
  // count of what was actually hashed is printed so a silent skip is impossible
  // to mistake for a pass.
  console.log('\n-- B10 sealed files (unconditional: no git, no skip) --');
  const sealNames = Object.keys(SEALED);
  let sealed = 0, sealBad = 0;
  for (const f of sealNames) {
    const p = path.join(__dirname, f);
    if (!fs.existsSync(p)) {
      sealBad++; no('B10', f + ' is ABSENT -- sealed as ' + SEALED[f]);
      continue;
    }
    const h = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
    sealed++;
    if (h !== SEALED[f]) {
      sealBad++;
      no('B10', f + ' MOVED');
      console.log('         sealed ' + SEALED[f]);
      console.log('         actual ' + h);
    }
  }
  console.log('  sealed files hashed: ' + sealed + '/' + sealNames.length);
  if (sealed !== sealNames.length) no('B10', 'only ' + sealed + ' of ' + sealNames.length + ' sealed files were readable');
  if (!sealBad) ok('all ' + sealNames.length + ' sealed files are byte-for-byte unchanged');

  // -- B11 the service worker's data-file policy, EXECUTED -----------------
  console.log('\n-- B11 service worker: data files must revalidate (item 80) --');
  const swPath = path.join(__dirname, SW_FILE);
  if (!fs.existsSync(swPath)) {
    no('B11', SW_FILE + ' is ABSENT -- the data-file policy cannot be executed');
  } else {
    // The cache name. Discovered by running the worker, not by reading a line.
    const probe = swLoad(swPath, () => Promise.resolve(swRes('NET')));
    if (!probe.hasFetchListener()) {
      no('B11', SW_FILE + ' registered no fetch listener -- nothing to assert');
    } else {
      probe.dispatch(SW_DATA_FILES[0]);
      await new Promise((r) => setTimeout(r, 0));
      const name = probe.opened[0];
      if (name === SW_CACHE) ok('service worker opens cache "' + SW_CACHE + '"');
      else no('B11', 'service worker opens cache ' + JSON.stringify(name) + ' -- SW_CACHE says "'
        + SW_CACHE + '". Re-cut both together, or the ship is invisible to every returning reader.');

      // Every data file, one at a time. A class assertion that only ever ran on
      // adhkar.json would not have caught worship-display.json.
      let stale = 0, frozen = 0, fragile = 0;
      for (const f of SW_REVALIDATED) {
        // (1) a HIT is served from the cache AND a background fetch is issued.
        const h = swLoad(swPath, () => Promise.resolve(swRes('NEW')));
        h.seed(name, f, 'OLD');
        const before = h.fetches();
        const d1 = h.dispatch(f);
        if (!d1.responded) { stale++; no('B11', f + ' is not handled by the worker at all'); continue; }
        const b1 = await swBody(d1.responded);
        if (b1 !== 'OLD') { stale++; no('B11', f + ' did not serve the STORED copy (got ' + JSON.stringify(b1) + ')'); }
        if (h.fetches() - before !== 1) {
          stale++;
          no('B11', f + ' was served from the cache with NO revalidation fetch (' + (h.fetches() - before)
            + '). This is item 80: a changed file stays frozen on every device until the cache name is bumped.');
        }
        if (!d1.waits.length) {
          stale++;
          no('B11', f + ' handed its revalidation to nothing -- the worker may be killed before the write lands');
        }

        // (2) the read AFTER the file changed returns the new bytes.
        await swSettle(d1.waits);
        if (h.peek(name, f) !== 'NEW') { frozen++; no('B11', f + ' revalidation never wrote the new bytes into the cache'); }
        const b2 = await swBody(h.dispatch(f).responded);
        if (b2 !== 'NEW') { frozen++; no('B11', f + ' still serves the old bytes after revalidation (' + JSON.stringify(b2) + ')'); }

        // (3) a FAILED fetch keeps the stored copy and raises nothing at the page.
        const hx = swLoad(swPath, () => Promise.reject(new Error('offline')));
        hx.seed(name, f, 'OLD');
        const d3 = hx.dispatch(f);
        let raised = null;
        await Promise.resolve(d3.responded).catch((e) => { raised = e; });
        if (raised) { fragile++; no('B11', f + ' let a network failure reach the page: ' + raised.message); }
        if (await swBody(d3.responded) !== 'OLD') { fragile++; no('B11', f + ' did not serve the stored copy while offline'); }
        for (const w of d3.waits) {
          await Promise.resolve(w).catch((e) => { fragile++; no('B11', f + ' revalidation promise rejected: ' + e.message); });
        }
        if (hx.peek(name, f) !== 'OLD') {
          fragile++;
          no('B11', f + ' LOST its stored copy to a failed fetch -- a reader with no network loses the file entirely');
        }
      }
      if (!stale) ok('all ' + SW_REVALIDATED.length + ' revalidating data files are served from cache AND revalidated in the background');
      if (!frozen) ok('all ' + SW_REVALIDATED.length + ' revalidating data files serve the NEW bytes on the read after a change');
      if (!fragile) ok('all ' + SW_REVALIDATED.length + ' revalidating data files survive a dead network with the stored copy intact');

      // ITEM 90: the excluded pair. Served from the store, and NEVER revalidated. A background
      // fetch here is 2.4 MB of a reader's data spent on bytes a sha256 already guarantees.
      let leaked = 0;
      for (const f of SW_SEALED_DATA) {
        const s = swLoad(swPath, () => Promise.resolve(swRes('NEW')));
        s.seed(name, f, 'OLD');
        const before = s.fetches();
        const d = s.dispatch(f);
        if (!d.responded) { leaked++; no('B11', f + ' is not handled by the worker at all'); continue; }
        const b = await swBody(d.responded);
        if (b !== 'OLD') { leaked++; no('B11', f + ' did not serve the STORED copy (got ' + JSON.stringify(b) + ')'); }
        const spent = s.fetches() - before;
        if (spent !== 0) {
          leaked++;
          no('B11', f + ' is sealed and excluded from revalidation, but the worker still issued '
            + spent + ' background fetch(es). Item 90: that is a phone re-downloading bytes that\n'
            + '        cannot have changed without breaking the seal above.');
        }
      }
      if (!leaked) ok('both sealed mushaf files are served from cache with ZERO revalidation fetch (item 90)');

      // ITEM 93: a precache entry that fails is COUNTED and NAMED. One CORE entry is made to
      // reject; install must still settle, and the worker must afterwards be able to say which
      // entry it lost. Silence here is how a reader ends up offline in front of a blank screen.
      const VICTIM = '/adhkar.json';
      const noisy = swLoad(swPath, () => Promise.resolve(swRes('NEW')), (u) => u === VICTIM);
      const inst = noisy.install();
      if (inst.missing) no('B11', SW_FILE + ' registered no install listener -- nothing to precache');
      else {
        let installRejected = null;
        for (const w of inst.waits) { await Promise.resolve(w).catch((e) => { installRejected = e; }); }
        if (installRejected) {
          no('B11', 'a failed precache entry REJECTED install (' + installRejected.message + '). The\n'
            + '        worker never activates, so a phone with a full disk keeps the OLD build forever.');
        } else ok('a failed precache entry does not reject install (item 93)');
        const rec = noisy.self.ezikPrecacheFailures;
        if (!rec || typeof rec.length !== 'number') {
          no('B11', 'a failed precache entry is recorded NOWHERE -- install completes one entry\n'
            + '        short with nothing counted and nothing logged. This is item 93.');
        } else if (rec.length !== 1) {
          no('B11', 'exactly one precache entry was made to fail; the worker counted ' + rec.length);
        } else if (String(rec[0] && rec[0].url) !== VICTIM) {
          no('B11', 'the failed entry was counted but not NAMED (got ' + JSON.stringify(rec[0])
            + ', expected ' + VICTIM + ')');
        } else ok('a failed precache entry raises the counter and records its name (item 93)');

        // The control. Without it, a recorder that reports a failure unconditionally would pass
        // every assertion above while measuring nothing.
        const clean = swLoad(swPath, () => Promise.resolve(swRes('NEW')));
        const ci = clean.install();
        await swSettle(ci.waits);
        const cleanRec = clean.self.ezikPrecacheFailures || [];
        if (cleanRec.length !== 0) {
          no('B11', 'a precache in which every entry stored still recorded ' + cleanRec.length
            + ' failure(s) -- the counter is not measuring what it is named for');
        } else ok('a precache with every entry storing records no failure (item 93 control)');
      }

      // The policies item 80 must NOT have moved. Without these, "revalidate
      // everything" would pass B11 while doubling every asset request and
      // unfreezing the quest bank the testers depend on being fresh.
      let moved = 0;
      const asset = swLoad(swPath, () => Promise.resolve(swRes('NEW')));
      asset.seed(name, '/icon-192.png', 'OLDPNG');
      const da = asset.dispatch('/icon-192.png');
      if (await swBody(da.responded) !== 'OLDPNG' || asset.fetches() !== 0) {
        moved++; no('B11', 'a content-stable asset is no longer cache-first (fetches=' + asset.fetches() + ')');
      }
      if (swLoad(swPath, () => Promise.resolve(swRes('x'))).dispatch('/api/chat').responded) {
        moved++; no('B11', '/api/* is being intercepted -- a cached religious answer is a wrong answer');
      }
      // ITEM 10: the whole Kunuz surface sits under one prefix and stays network-only.
      for (const qp of ['/quest.html', '/quest-ghaws.html', '/quest-harb.html', '/quest-test.html', '/quest-board.html', '/' + BANK]) {
        if (swLoad(swPath, () => Promise.resolve(swRes('x'))).dispatch(qp).responded
          || swLoad(swPath, () => Promise.resolve(swRes('x'))).dispatch(qp, 'navigate').responded) {
          moved++; no('B11', 'the worker intercepts ' + qp + ' -- a phone would be frozen on an old Kunuz page or bank');
        }
      }
      const shell = swLoad(swPath, () => Promise.resolve(swRes('SHELL')));
      shell.seed(name, '/', 'OLDSHELL');
      if (await swBody(shell.dispatch('/', 'navigate').responded) !== 'SHELL') {
        moved++; no('B11', 'the app shell is no longer network-first');
      }
      if (!moved) ok('the four policies item 80 does not govern are untouched (asset / api / quest-data / shell)');
    }
  }

  // -- B12 the service worker's storage quota, EXECUTED (item 91-A) --------
  //
  // Four states, and the worker is asked what it DID in each: what it wrote, what it deleted,
  // what it recorded. Not one assertion below reads a line of sw.js. The states are the four
  // a reader actually meets -- room to spare, no room before the first byte, room that runs out
  // half way through, and a browser too old to have been asked.
  console.log('\n-- B12 service worker: storage quota management (item 91-A) --');
  if (!fs.existsSync(swPath)) {
    no('B12', SW_FILE + ' is ABSENT -- the quota policy cannot be executed');
  } else {
    const OLD_STORE = 'ezik-v6';
    const WIDE = { quota: 500 * 1024 * 1024, usage: 1024 * 1024 };
    // Free space measured in kilobytes against a CORE measured in megabytes. Narrow by
    // arithmetic, not by a number chosen to sit under a threshold this guard also owns.
    const NARROW = { quota: 2 * 1024 * 1024, usage: 2 * 1024 * 1024 - 64 * 1024 };
    const settle = async (r) => { await swSettle(r.waits); };

    // ---- STATE 1: a wide quota. CORE is stored WHOLE, and persistence is asked for once. ----
    {
      const nav = swNav(WIDE);
      const h = swLoad(swPath, () => Promise.resolve(swRes('NET')), null, nav.navigator);
      const inst = h.install();
      let rejected = null;
      for (const w of inst.waits) { await Promise.resolve(w).catch((e) => { rejected = e; }); }
      const st = h.storage();
      if (inst.missing) no('B12', SW_FILE + ' registered no install listener');
      else if (rejected) no('B12', 'a WIDE quota install rejected: ' + rejected.message);
      else {
        const name = h.opened[0];
        const missing = SW_CORE.filter((u) => !h.has(name, u));
        if (missing.length) {
          no('B12', 'with room to spare the worker stored only ' + (SW_CORE.length - missing.length)
            + ' of ' + SW_CORE.length + ' CORE entries; missing ' + missing.join(', ')
            + '.\n        Item 91-A must not cost the sane case a single file.');
        } else ok('a wide quota stores all ' + SW_CORE.length + ' CORE entries (91-A costs the sane case nothing)');
        const rec = h.self.ezikPrecacheFailures || [];
        if (rec.length) no('B12', 'a wide-quota install recorded ' + rec.length + ' failure(s)');
        if (!st) {
          no('B12', 'the worker exposes no storage record at all -- a page cannot tell a full\n'
            + '        disk from a dead network, which is the whole of item 91-A part 3.');
        } else {
          if (nav.calls.estimate < 1) {
            no('B12', 'navigator.storage.estimate() was NEVER called before the first write.\n'
              + '        The worker writes into a store it has not measured -- item 91-A part 1.');
          } else ok('the worker estimates the quota before it writes (' + nav.calls.estimate + ' call(s))');
          if (nav.calls.persist !== 1) {
            no('B12', 'navigator.storage.persist() was called ' + nav.calls.persist
              + ' time(s); item 91-A part 2 says exactly once.');
          } else if (st.persist !== 'granted') {
            no('B12', 'persist() resolved TRUE and the worker recorded ' + JSON.stringify(st.persist));
          } else ok('the worker asks for persistence exactly once and records the grant');
          if (st.precacheSkipped !== null) {
            no('B12', 'a wide quota still skipped the precache (' + JSON.stringify(st.precacheSkipped) + ')');
          }
          const est = st.estimate;
          if (!est || typeof est.need !== 'number' || typeof est.free !== 'number') {
            no('B12', 'the estimate was taken but not RECORDED (' + JSON.stringify(est) + ')');
          } else if (est.need <= 0) {
            no('B12', 'the worker needs ' + est.need + ' bytes for CORE -- a threshold of zero\n'
              + '        is a pre-check that can never refuse anything.');
          } else ok('the estimate is recorded with the need it was measured against (' + est.need + ' bytes)');
        }
      }
    }

    // ---- STATE 2: too narrow to start. NOTHING is written, and the reason is recorded. ----
    {
      const nav = swNav(NARROW);
      const h = swLoad(swPath, () => Promise.resolve(swRes('NET')), null, nav.navigator);
      const inst = h.install();
      let rejected = null;
      for (const w of inst.waits) { await Promise.resolve(w).catch((e) => { rejected = e; }); }
      const st = h.storage();
      if (rejected) {
        no('B12', 'a NARROW quota REJECTED install (' + rejected.message + '). The worker never\n'
          + '        activates, so the phone keeps the old build forever -- item 93 in reverse.');
      } else ok('a quota too narrow for CORE still settles install (the worker activates)');
      const attempted = h.adds();
      if (attempted.length !== 0) {
        no('B12', 'the worker began writing anyway: ' + attempted.length + ' cache.add call(s) into a\n'
          + '        store measured too small to hold CORE. Item 91-A part 1 says the write does\n'
          + '        not START -- otherwise the failure list fills with one entry per file and the\n'
          + '        disk ends exactly as full as it began.');
      } else ok('a quota too narrow for CORE writes NOTHING (no cache.add is attempted)');
      if (!st || st.precacheSkipped !== 'quota') {
        no('B12', 'the skipped precache recorded ' + JSON.stringify(st && st.precacheSkipped)
          + ', not "quota". A silent skip is indistinguishable from a worker that did its job.');
      } else ok('the skip is recorded as a quota decision, readable by the page');
      const est = st && st.estimate;
      if (!est || typeof est.free !== 'number' || typeof est.need !== 'number' || !(est.free < est.need)) {
        no('B12', 'the refusal is not backed by a recorded measurement (' + JSON.stringify(est) + ')');
      } else ok('the refusal carries its arithmetic: ' + est.free + ' free < ' + est.need + ' needed');
      const rec = h.self.ezikPrecacheFailures || [];
      if (rec.length !== 0) {
        no('B12', 'the skipped precache still recorded ' + rec.length + ' per-entry failure(s) --\n'
          + '        the skip is supposed to REPLACE that list, not populate it');
      } else ok('a skipped precache records no per-file failures (one decision, not seven)');
    }

    // ---- STATE 3: the disk fills MID-WRITE. Old stores go, the current one never does. ----
    {
      const nav = swNav(WIDE);
      // Fails every add until an eviction has happened, then stops failing. A retry that was
      // never going to be needed proves nothing; this one only succeeds because room was made.
      const h = swLoad(swPath, () => Promise.resolve(swRes('NET')),
        (u, ctx) => (ctx.deleted.length === 0 ? 'quota' : false), nav.navigator);
      h.seedStore(OLD_STORE);
      const inst = h.install();
      let rejected = null;
      for (const w of inst.waits) { await Promise.resolve(w).catch((e) => { rejected = e; }); }
      const st = h.storage();
      const gone = h.deleted();
      if (rejected) no('B12', 'a mid-write quota failure REJECTED install (' + rejected.message + ')');
      else ok('a disk that fills mid-write still settles install');
      if (gone.indexOf(SW_CACHE) !== -1) {
        no('B12', 'the worker deleted its OWN store "' + SW_CACHE + '" to make room for it.\n'
          + '        That trades the entries already written for the space to write them again,\n'
          + '        and takes the offline fallback down with them.');
      } else ok('the eviction never touches the current store "' + SW_CACHE + '"');
      if (gone.indexOf(OLD_STORE) === -1) {
        no('B12', 'a full disk did not evict the stale store "' + OLD_STORE + '" (deleted: '
          + JSON.stringify(gone) + '). Item 91-A part 4: old stores go FIRST, and nothing else\n'
          + '        on the device is the worker\'s to free.');
      } else ok('a full disk evicts the stale store "' + OLD_STORE + '" first');
      if (!st || !(st.evicted > 0)) no('B12', 'the eviction is not recorded (evicted=' + (st && st.evicted) + ')');
      if (!st || !(st.retried > 0)) {
        no('B12', 'nothing was retried after the eviction (retried=' + (st && st.retried) + ').\n'
          + '        Making room and then not using it leaves the reader exactly where they were.');
      } else ok('the entry is retried after the eviction (' + st.retried + ' retry/retries)');
      const name = h.opened[0];
      const stored = SW_CORE.filter((u) => h.has(name, u));
      if (stored.length !== SW_CORE.length) {
        no('B12', 'after evicting and retrying, only ' + stored.length + ' of ' + SW_CORE.length
          + ' CORE entries landed');
      } else ok('after the eviction the retry stores all ' + SW_CORE.length + ' CORE entries');
    }

    // ---- STATE 3b: the retry ALSO fails. Recorded ONCE, named, and with its reason. ----
    {
      const nav = swNav(WIDE);
      const h = swLoad(swPath, () => Promise.resolve(swRes('NET')),
        (u) => (u === '/adhkar.json' ? 'quota' : false), nav.navigator);
      const inst = h.install();
      for (const w of inst.waits) { await Promise.resolve(w).catch(() => {}); }
      const rec = h.self.ezikPrecacheFailures || [];
      const mine = rec.filter((r) => r && r.url === '/adhkar.json');
      if (mine.length !== 1) {
        no('B12', 'an entry that failed twice (write, then retry) was recorded ' + mine.length
          + ' time(s); a page reading the count would see the same file twice.');
      } else if (mine[0].reason !== 'quota') {
        no('B12', 'a QuotaExceededError was filed under reason ' + JSON.stringify(mine[0].reason)
          + '. Item 91-A part 3: the reason is what tells a full disk from a dead tunnel.');
      } else ok('an entry whose retry also fails is recorded once, named, and reasoned "quota"');
    }

    // ---- STATE 3c: a NETWORK failure must not evict anything. ----
    // The eviction rule is a response to a full disk. Firing it at a dead network would cost a
    // reader the store they still have in exchange for bytes no deletion can produce.
    {
      const nav = swNav(WIDE);
      const h = swLoad(swPath, () => Promise.resolve(swRes('NET')),
        (u) => (u === '/adhkar.json' ? 'network' : false), nav.navigator);
      h.seedStore(OLD_STORE);
      const inst = h.install();
      for (const w of inst.waits) { await Promise.resolve(w).catch(() => {}); }
      const gone = h.deleted();
      const rec = (h.self.ezikPrecacheFailures || []).filter((r) => r && r.url === '/adhkar.json');
      if (gone.length !== 0) {
        no('B12', 'a NETWORK failure evicted ' + JSON.stringify(gone) + '. Deleting a stale store\n'
          + '        cannot conjure bytes off a dead network; it only costs the reader what they had.');
      } else ok('a network failure evicts nothing (the eviction rule answers a full disk only)');
      if (mineReason(rec) !== 'network') {
        no('B12', 'a failed fetch was filed under reason ' + JSON.stringify(mineReason(rec))
          + ' instead of "network" -- the two reasons ask opposite things of the reader.');
      } else ok('a failed fetch is recorded with reason "network"');
    }

    // ---- STATE 4: no navigator.storage at all. The worker behaves as it did before 91-A. ----
    // An old browser must not be turned into a worker that caches nothing by a quota check it
    // cannot answer. This is the state that makes 'unknown' mean WRITE.
    {
      const h = swLoad(swPath, () => Promise.resolve(swRes('NET')), null, undefined);
      const inst = h.install();
      let rejected = null;
      for (const w of inst.waits) { await Promise.resolve(w).catch((e) => { rejected = e; }); }
      const st = h.storage();
      if (rejected) {
        no('B12', 'a browser with no navigator.storage made install REJECT (' + rejected.message
          + '). The quota check has to be optional or it is a new way to strand a phone.');
      } else ok('a browser with no navigator.storage still settles install');
      const name = h.opened[0];
      const missing = SW_CORE.filter((u) => !h.has(name, u));
      if (missing.length) {
        no('B12', 'with no navigator.storage the worker stored only ' + (SW_CORE.length - missing.length)
          + ' of ' + SW_CORE.length + ' CORE entries (missing ' + missing.join(', ') + ').\n'
          + '        An unmeasurable quota must mean WRITE, exactly as before item 91-A.');
      } else ok('with no navigator.storage all ' + SW_CORE.length + ' CORE entries are still stored');
      if (!st || st.estimate !== 'unavailable' || st.persist !== 'unavailable') {
        no('B12', 'the missing API was not recorded as unavailable (estimate='
          + JSON.stringify(st && st.estimate) + ', persist=' + JSON.stringify(st && st.persist) + ')');
      } else ok('the absent API is recorded as "unavailable", not as a failure');
    }

    // ---- STATE 2 -> activate: the sweep frees the space, and the retry uses it. ----
    // Without this the quota skip would be a NEW way to strand a reader: install writes nothing,
    // activate sweeps the old store, and the device is left holding neither.
    {
      let free = NARROW.quota - NARROW.usage;
      const navigator = { storage: {
        estimate: () => Promise.resolve({ quota: NARROW.quota, usage: NARROW.quota - free }),
        persist: () => Promise.resolve(true),
      } };
      const h = swLoad(swPath, () => Promise.resolve(swRes('NET')), null, navigator);
      h.seedStore(OLD_STORE);
      const inst = h.install();
      await swSettle(inst.waits);
      // The sweep in activate is what frees the room, so the estimate it re-takes must see it.
      free = WIDE.quota - WIDE.usage;
      const act = h.activate();
      if (act.missing) no('B12', SW_FILE + ' registered no activate listener');
      else {
        await swSettle(act.waits);
        const st = h.storage();
        const name = h.opened[0];
        const stored = SW_CORE.filter((u) => h.has(name, u));
        if (h.deleted().indexOf(SW_CACHE) !== -1) {
          no('B12', 'activate deleted the CURRENT store "' + SW_CACHE + '"');
        }
        if (stored.length !== SW_CORE.length) {
          no('B12', 'a quota-skipped install was never retried after activate swept the old\n'
            + '        store: only ' + stored.length + ' of ' + SW_CORE.length + ' CORE entries are\n'
            + '        present, so the reader holds an empty new cache and no old one.');
        } else ok('a quota-skipped install is retried once activate has swept the old store');
        if (!st || st.activateRetry !== 'done') {
          no('B12', 'the post-activate retry is not recorded (activateRetry='
            + JSON.stringify(st && st.activateRetry) + ')');
        } else ok('the post-activate retry is recorded on the same channel');
      }
    }

    // ---- ITEM 112. CORE_BYTES IS DERIVED HERE, NOT REMEMBERED THERE. ------
    //
    // WHAT STOOD HERE. This block used to accept any CORE_BYTES that was GREATER THAN OR EQUAL
    // TO what CORE weighs -- `Number(m[1]) < onDisk` was the only failure. That caught the shell
    // growing and nothing else, and it was half a check in both directions:
    //   * a file SHRINKING left the constant silently overstating CORE, so CORE_NEED (1.5x)
    //     became stricter than the files justify and install could refuse to write on a phone
    //     that had the room. Nothing anywhere went red.
    //   * a constant cut by hand from the comment table beside it could be wrong from birth and
    //     still pass, as long as it erred high.
    // Merge round (b) of 2026-08-21 is the measured case: the branch declared 1634924, the merge
    // weighed 1644371, and the 9447-byte difference was index.html growing on the other side.
    // Neither branch was broken. A hand-copied measurement of seven files that two people edit
    // cannot survive, so it is no longer copied: tools/core-bytes.cjs writes it, and this asserts
    // it EXACTLY, in both directions, on every gate run.
    //
    // AND IT IS NOT THE TOOL'S OWN ARITHMETIC READ BACK. This parses CORE out of sw.js with its
    // own reader and maps it to disk with its own rule; a bug shared with the tool would have to
    // be written twice, in two files, in two shapes. The hand-written SW_CORE / SW_CORE_FILES
    // above are then asserted AGAINST that parse, so the copy the rest of B12 drives cannot drift
    // from the list the worker actually installs.
    {
      const src = fs.readFileSync(swPath, 'utf8');
      let parsed = null, parseError = null;
      try {
        const at = src.indexOf('const CORE = [');
        if (at === -1) throw new Error('sw.js declares no `const CORE = [` array');
        const open = src.indexOf('[', at);
        const close = src.indexOf('];', open);
        if (close === -1) throw new Error('the CORE array is never closed');
        // CORE carries prose between its entries; a scan that did not strip it would collect a
        // path quoted inside a sentence as though the worker precached it.
        const body = src.slice(open + 1, close).replace(/\/\/[^\n]*/g, '');
        parsed = [...body.matchAll(/'([^']*)'/g)].map((mm) => mm[1]);
        if (!parsed.length) throw new Error('the CORE array holds no entries');
      } catch (e) { parseError = e; }

      if (parseError) {
        no('B12', 'CORE could not be read out of ' + SW_FILE + ' (' + parseError.message + ').\n'
          + '        Without the worker\'s own list there is nothing to weigh, and the constant\n'
          + '        below becomes unfalsifiable rather than merely wrong.');
      } else {
        if (JSON.stringify(parsed) !== JSON.stringify(SW_CORE)) {
          no('B12', 'SW_CORE is ' + JSON.stringify(SW_CORE) + ' but the worker precaches\n'
            + '        ' + JSON.stringify(parsed) + '. Every B12 state above drives the FIRST list;\n'
            + '        while they differ, this gate is asserting about a CORE nobody installs.');
        } else ok('SW_CORE is still the list sw.js precaches (' + parsed.length + ' entries, read from the worker)');

        const derived = parsed.map((u) => (u === '/' ? 'index.html' : u.replace(/^\//, '')));
        if (JSON.stringify(derived) !== JSON.stringify(SW_CORE_FILES)) {
          no('B12', 'CORE maps to ' + JSON.stringify(derived) + ' on disk, but SW_CORE_FILES says\n'
            + '        ' + JSON.stringify(SW_CORE_FILES) + '. The byte sum below would then weigh\n'
            + '        files the worker does not store -- a pre-check measured against the wrong\n'
            + '        seven files fails nothing and protects nothing.');
        } else ok('CORE maps onto the files SW_CORE_FILES names (\'/\' -> index.html, the rest by path)');

        let onDisk = 0;
        const unreadable = [];
        for (const f of derived) {
          const p = path.join(__dirname, f);
          if (!fs.existsSync(p)) { unreadable.push(f); continue; }
          onDisk += fs.statSync(p).size;
        }
        const m = src.match(/CORE_BYTES\s*=\s*(\d+)/);
        if (unreadable.length) {
          no('B12', 'CORE names ' + unreadable.join(', ') + ', which is not on disk');
        } else if (!m) {
          no('B12', 'sw.js declares no CORE_BYTES constant -- the pre-check has no measured size\n'
            + '        to compare a quota against, so nothing pins it to the files it describes.');
        } else if (Number(m[1]) !== onDisk) {
          const drift = onDisk - Number(m[1]);
          no('B12', 'CORE_BYTES = ' + m[1] + ' but CORE weighs ' + onDisk + ' bytes on disk ('
            + (drift > 0 ? '+' : '') + drift + ').\n'
            + '        The quota pre-check is measured against a number that stopped being true.\n'
            + '        Repair it with `node tools/core-bytes.cjs --write` and re-cut the sw.js\n'
            + '        digest in the SAME commit -- never by hand from the comment table.');
        } else ok('CORE_BYTES (' + m[1] + ') equals the ' + onDisk + ' bytes CORE weighs on disk, exactly');
      }
    }
  }

  // -- B14 EVERY NUMBER sw.js's PROSE STATES IS TRUE OF THE DISK (item 115-ب) ---
  //
  // WHAT STOOD HERE: nothing. B12 above re-derives ONE number, CORE_BYTES. The worker also states
  // eleven other measurements in its comments -- the size of each CORE file, the two mushaf files,
  // the three revalidating data files -- and not one of them was read by anything.
  //
  // The 2026-08-21 inventory measured the damage. The CORE table in the comment said index.html
  // weighed 1059309 when it weighed 1068756, and the 9447-byte difference was the SAME drift that
  // had stopped the merge round. Whoever re-cut the constant fixed the NUMBER and left the TABLE
  // IT IS DERIVED FROM saying something else. A comment that lies is not a cosmetic defect here:
  // it is the input the next person re-cuts CORE_BYTES from.
  //
  // So the prose is a contract. Each claim below names the file it measures; the size is read off
  // the disk and compared exactly, in both directions. And COMPLETENESS is asserted too: any
  // integer of 500 or more appearing in a sw.js comment which is not in this table -- or in the
  // short list of things that are not measurements at all, each with its reason -- is a failure.
  // A new number cannot enter the worker's prose without being registered here, which is the only
  // way a table like this survives longer than one commit.
  {
    const swProseSrc = fs.readFileSync(path.join(__dirname, SW_FILE), 'utf8');
    const swComments = swProseSrc.split(/\r?\n/)
      .map((line) => { const c = line.indexOf('//'); return c === -1 ? '' : line.slice(c); })
      .join('\n');

    // ITEM 33 added a third claim shape. The 604 page scans are not one file and not a short
    // list of them -- naming all 604 here would be a table nobody can read -- so the claim names
    // the DIRECTORY and the number is derived by counting and summing whatever is in it.
    const MUSHAF_DIR = 'assets/madina-hafs';
    const MUSHAF_PAGE_FILE = /^page-\d{3}\.webp$/;
    const mushafPageSizes = () => {
      const dir = path.join(__dirname, MUSHAF_DIR);
      if (!fs.existsSync(dir)) return null;
      return fs.readdirSync(dir).filter((f) => MUSHAF_PAGE_FILE.test(f)).sort()
        .map((f) => fs.statSync(path.join(dir, f)).size);
    };

    //  { n, of }           n is the byte size of that file on disk
    //  { n, sum: [a, b] }  n is the byte sum of those files on disk
    //  { n, dir: 'count' | 'sum' | 'mean' }   n is that statistic over the mushaf page scans
    const SW_PROSE = [
      { n: 155556, of: 'index.html' },
      // ITEM 85. The two CORE entries the self-hosted faces added, stated in the worker's byte
      // table beside the rest and re-derived here from the files they name. They are the arabic
      // and latin cuts of Noto Naskh Arabic, which is what the first screen is painted in.
      { n: 94032, of: 'fonts/RrQKbpV-9Dd1b1OAGA6M9PkyDuVBeN2DHV20Lg.woff2' },
      { n: 19696, of: 'fonts/RrQKbpV-9Dd1b1OAGA6M9PkyDuVBeN2GHV0.woff2' },
      // ITEM 74. The four Latin faces of Tajawal, stated in the worker's byte table and re-derived here from the files they name.
      { n: 10256, of: 'fonts/Iura6YBj_oCad4k1nzGBCw.woff2' },
      { n: 9900, of: 'fonts/Iurf6YBj_oCad4k1l8KiHrFpiQ.woff2' },
      { n: 9996, of: 'fonts/Iurf6YBj_oCad4k1l4qkHrFpiQ.woff2' },
      { n: 10584, of: 'fonts/Iurf6YBj_oCad4k1l5anHrFpiQ.woff2' },
      // ITEM 32. The three CORE entries the CDN removal added, each stated in the worker's own
      // byte table and each re-derived here from the file it names.
      { n: 2356171, of: 'app.js' },
      { n: 131835, of: 'vendor/react-dom.umd.js' },
      { n: 10751, of: 'vendor/react.umd.js' },
      { n: 368386, of: 'icon-watermark.png' },
      { n: 177392, of: 'adhkar.json' },
      // The owner's split of category 27, precached beside adhkar.json since the ship round.
      { n: 7182, of: 'adhkar-split-27.json' },
      // ITEM 2. The two corpora that joined CORE on 2026-09-13 -- the forty and the daily verse's
      // tafsir -- each stated in the worker's byte table and re-derived here from the file it names.
      { n: 47288, of: 'arbaeen.json' },
      { n: 23984, of: 'daily-tafsir.json' },
      // ITEM 89 (2026-10-13). The forty-two's explanation, warmed last in IDLE and out of CORE; its
      // size is stated in the IDLE note and re-derived here from the file it names. (Item 4's
      // footnotes left CORE with the fifty they belonged to.)
      { n: 272517, of: 'arbaeen-sharh.json' },
      // ITEM 87. The day from waking to sleeping, the sixth corpus in CORE, stated in the
      // worker's byte table and re-derived here from the file it names.
      { n: 84759, of: 'sunan-day.json' },
      { n: 12893, of: 'icon-512.png' },
      { n: 5938, of: 'icon-maskable-512.png' },
      { n: 5053, of: 'icon-192.png' },
      { n: 533, of: 'manifest.json' },
      { n: 1412005, of: 'quran-uthmani.json' },
      { n: 996528, of: 'mushaf-layout.json' },
      { n: 18132, of: 'worship-display.json' },
      // ITEM 4 OF THE REGISTER (OFFLINE). The two sheets of the names of Allah joined the worker's
      // IDLE list beside worship-display.json; each size is stated in the worker's prose and
      // re-derived here from the file it names.
      { n: 153202, of: 'asmaa-dataset-final-r3.json' },
      { n: 7180, of: 'asmaa-rules-page-r2.json' },
      { n: 2408533, sum: ['quran-uthmani.json', 'mushaf-layout.json'] },
      // ITEM 33. The three the page-cap prose states, each re-derived from the directory.
      { n: 604, dir: 'count' },
      { n: 66012516, dir: 'sum' },
      { n: 109292, dir: 'mean' },
    ];

    // Integers in the prose that are NOT a measurement of a file, each with the reason it cannot
    // be checked. This is item 115-ب's third column -- declared uncheckable, in writing, rather
    // than left standing as something a reader would take for a fact.
    const SW_PROSE_NOT_MEASUREMENTS = {
      512: 'a fragment of the filenames icon-512.png and icon-maskable-512.png, not a size',
      298686: 'a SUPERSEDED transfer size for the shell. A transfer size depends on the CDN encoder, '
        + 'its settings and its version, none of which are in this tree, so nothing here can ever '
        + 'check it. It survives in the prose only to record what was removed and why.',
      338409: 'a SUPERSEDED transfer size for quran-uthmani.json -- same reason.',
      151653: 'a SUPERSEDED transfer size for mushaf-layout.json -- same reason.',
    };

    let proseBad = 0;
    for (const claim of SW_PROSE) {
      const files = claim.dir ? [] : (claim.sum || [claim.of]);
      let label = claim.dir ? (MUSHAF_DIR + ' ' + claim.dir)
        : (claim.sum ? claim.sum.join(' + ') : claim.of);
      let total = 0;
      let missing = null;
      if (claim.dir) {
        const sizes = mushafPageSizes();
        if (!sizes || !sizes.length) missing = MUSHAF_DIR;
        else {
          const sum = sizes.reduce((a, b) => a + b, 0);
          total = claim.dir === 'count' ? sizes.length
            : claim.dir === 'sum' ? sum
              : Math.floor(sum / sizes.length);
        }
      }
      for (const name of files) {
        const p = path.join(__dirname, name);
        if (!fs.existsSync(p)) { missing = name; break; }
        total += fs.statSync(p).size;
      }
      if (missing) {
        proseBad++;
        no('B14', label + ' is named in sw.js prose and ' + missing + ' is not on disk');
        continue;
      }
      if (!new RegExp('\\b' + claim.n + '\\b').test(swComments)) {
        proseBad++;
        no('B14', 'sw.js prose no longer states ' + claim.n + ' for ' + label + '.\n'
          + '        Either the sentence was rewritten and this table was not, or the measurement\n'
          + '        was dropped from the worker while the table still claims it is there.');
        continue;
      }
      if (total !== claim.n) {
        proseBad++;
        no('B14', 'sw.js prose says ' + label + ' is ' + claim.n + ' bytes; the disk says ' + total
          + ' (' + (total > claim.n ? '+' : '') + (total - claim.n) + ').\n'
          + '        A comment that states a size is what the next person re-cuts CORE_BYTES from,\n'
          + '        so it is wrong in exactly the way the constant used to be.');
      }
    }
    if (!proseBad) {
      ok('every size sw.js states in prose is true of the disk (' + SW_PROSE.length + ' claims)');
    }

    // COMPLETENESS. A table of claims that does not know what it has missed goes quiet the first
    // time somebody writes a new number into the worker.
    const knownNumbers = new Set(SW_PROSE.map((c) => c.n));
    const excusedNumbers = new Set(Object.keys(SW_PROSE_NOT_MEASUREMENTS).map(Number));
    const unregistered = [];
    for (const mm of swComments.matchAll(/\b(\d{3,})\b/g)) {
      const v = Number(mm[1]);
      if (v < 500) continue;
      if (knownNumbers.has(v) || excusedNumbers.has(v)) continue;
      if (unregistered.indexOf(v) === -1) unregistered.push(v);
    }
    if (unregistered.length) {
      no('B14', 'sw.js prose states ' + unregistered.join(', ') + ' and nothing checks it.\n'
        + '        Register each one in SW_PROSE with the file it measures, or in\n'
        + '        SW_PROSE_NOT_MEASUREMENTS with the reason it cannot be checked. There is no\n'
        + '        third option: a number in this worker that nothing re-measures is the defect\n'
        + '        item 115-ب was raised to end.');
    } else {
      ok('no unregistered number of 500 or more survives in sw.js prose ('
        + excusedNumbers.size + ' declared uncheckable, each with its reason)');
    }
  }

  // -- B13 the service worker's END-OF-INSTALL REPORT, EXECUTED (item 93-b) --
  //
  // Item 93 made a failed precache entry countable and nameable; 91-A gave it a reason. Both
  // left the record behind a REQUEST, so a page learns its offline store is short an entry only
  // if it thinks to ask -- and the readers who never ask are exactly the ones who meet the gap
  // with no network. 93-b pushes the brief at the end of install instead.
  //
  // FOUR STATES, and the worker is asked what it SENT in each: a clean install, one entry down,
  // several entries down, and NOBODY LISTENING. The fourth is the one that decides whether this
  // is a feature or a new way to strand a phone: the first install of a new worker routinely
  // runs before any page is controlled, so an empty client list is the healthiest install there
  // is and must cost nothing at all.
  console.log('\n-- B13 service worker: the end-of-install report (item 93-b) --');
  if (!fs.existsSync(swPath)) {
    no('B13', SW_FILE + ' is ABSENT -- the report channel cannot be executed');
  } else {
    const WIDE13 = { quota: 500 * 1024 * 1024, usage: 1024 * 1024 };
    const NARROW13 = { quota: 2 * 1024 * 1024, usage: 2 * 1024 * 1024 - 64 * 1024 };
    const reportsOf = (h) => h.posted().map((p) => p.message).filter((m) => m && m.ezik === SW_REPORT_TAG);

    // ---- STATE 1: everything stored. The page is told so, unasked. ----------
    {
      const nav = swNav(WIDE13);
      const h = swLoad(swPath, () => Promise.resolve(swRes('NET')), null, nav.navigator, { count: 1 });
      const inst = h.install();
      let rejected = null;
      for (const w of inst.waits) { await Promise.resolve(w).catch((e) => { rejected = e; }); }
      if (rejected) no('B13', 'a clean install REJECTED once it had a report to send: ' + rejected.message);
      const reports = reportsOf(h);
      if (reports.length !== 1) {
        no('B13', 'a clean install sent ' + reports.length + ' report(s) to 1 listening client.\n'
          + '        Item 93-b is the PUSH: a record that still has to be asked for is item 93,\n'
          + '        and item 93 is the state a reader already meets with no network.');
      } else {
        const r = reports[0];
        if (r.failed !== 0 || (r.entries && r.entries.length !== 0)) {
          no('B13', 'a clean install reported ' + r.failed + ' failure(s) and '
            + JSON.stringify(r.entries) + '. A report that cries on a healthy install is a report\n'
            + '        the page learns to ignore before the first real one arrives.');
        } else ok('a clean install hands every client a report saying nothing failed');
        if (r.skipped !== null) {
          no('B13', 'a clean install reported skipped=' + JSON.stringify(r.skipped));
        } else ok('...and it carries what install DECIDED, not only what it counted');
        const st = h.storage();
        if (!st || st.announced !== 1) {
          no('B13', 'the announcement is not recorded (announced=' + JSON.stringify(st && st.announced)
            + '). A page that asks must be able to tell "nothing failed" from "you were never told".');
        } else ok('the number of clients told is recorded on the storage channel');
        const calls = h.matchAllCalls();
        if (!calls.length || !calls[0] || calls[0].includeUncontrolled !== true) {
          no('B13', 'clients were looked up as ' + JSON.stringify(calls[0]) + '. On a FIRST install\n'
            + '        nothing is controlled yet, so without includeUncontrolled the page that just\n'
            + '        registered this worker -- the one that wants the brief -- is never found.');
        } else ok('the lookup includes uncontrolled clients (the first install has no controlled page)');
      }
      const missing = SW_CORE.filter((u) => !h.has(h.opened[0], u));
      if (missing.length) no('B13', 'the report cost the precache ' + missing.length + ' entr(y/ies)');
    }

    // ---- STATE 2: one entry fails. It is named, with its reason. ------------
    {
      const nav = swNav(WIDE13);
      const h = swLoad(swPath, () => Promise.resolve(swRes('NET')),
        (u) => (u === '/adhkar.json' ? 'network' : false), nav.navigator, { count: 1 });
      const inst = h.install();
      for (const w of inst.waits) { await Promise.resolve(w).catch(() => {}); }
      const reports = reportsOf(h);
      if (reports.length !== 1) {
        no('B13', 'an install with one failed entry sent ' + reports.length + ' report(s)');
      } else {
        const r = reports[0];
        if (r.failed !== 1 || !Array.isArray(r.entries) || r.entries.length !== 1) {
          no('B13', 'one entry failed and the report said failed=' + r.failed + ', entries='
            + JSON.stringify(r.entries));
        } else if (r.entries[0].url !== '/adhkar.json') {
          no('B13', 'the failed entry was counted but not NAMED (' + JSON.stringify(r.entries[0]) + ').\n'
            + '        A count with no name tells a page that something is missing and not what.');
        } else if (r.entries[0].reason !== 'network') {
          no('B13', 'a failed fetch reached the page as reason ' + JSON.stringify(r.entries[0].reason)
            + '. "Your disk is full" and "you are offline" ask opposite things of a reader.');
        } else ok('a single failed entry reaches the page named and reasoned ("/adhkar.json", network)');
      }
    }

    // ---- STATE 3: several entries fail. ALL of them travel. -----------------
    // A report that carried only the first would be indistinguishable from a report of one
    // failure, and the difference is whether the store is short a file or short a shelf.
    {
      const nav = swNav(WIDE13);
      const down = ['/adhkar.json', '/icon-watermark.png', '/manifest.json'];
      const h = swLoad(swPath, () => Promise.resolve(swRes('NET')),
        (u) => (down.indexOf(u) !== -1 ? 'network' : false), nav.navigator, { count: 1 });
      const inst = h.install();
      let rejected = null;
      for (const w of inst.waits) { await Promise.resolve(w).catch((e) => { rejected = e; }); }
      if (rejected) no('B13', 'three failed entries REJECTED install: ' + rejected.message);
      const reports = reportsOf(h);
      const r = reports[0];
      if (reports.length !== 1 || !r) {
        no('B13', 'an install with three failed entries sent ' + reports.length + ' report(s)');
      } else if (r.failed !== down.length) {
        no('B13', 'three entries failed and the report counted ' + r.failed);
      } else {
        const named = (r.entries || []).map((e) => e.url).sort();
        if (JSON.stringify(named) !== JSON.stringify(down.slice().sort())) {
          no('B13', 'three entries failed and the report named ' + JSON.stringify(named)
            + '. Truncating the list makes "one file missing" and "three files missing" the same\n'
            + '        message at the page.');
        } else ok('every failed entry travels, not just the first (3 of 3 named)');
        const stored = SW_CORE.filter((u) => h.has(h.opened[0], u));
        if (stored.length !== SW_CORE.length - down.length) {
          no('B13', 'the report disagrees with the store: ' + stored.length + ' of '
            + SW_CORE.length + ' entries present against ' + r.failed + ' reported failures');
        } else ok('...and the report matches what the store actually holds');
      }
    }

    // ---- STATE 4: NOBODY IS LISTENING. The install is untouched. ------------
    // This is the normal first install, not an error state. If it costs anything -- a rejection,
    // an unstored entry, a recorded failure -- then 93-b has bought observability by making the
    // healthy case worse, which is a straight loss.
    {
      const nav = swNav(WIDE13);
      const h = swLoad(swPath, () => Promise.resolve(swRes('NET')), null, nav.navigator, { count: 0 });
      const inst = h.install();
      let rejected = null;
      for (const w of inst.waits) { await Promise.resolve(w).catch((e) => { rejected = e; }); }
      if (rejected) {
        no('B13', 'an install with NO client rejected (' + rejected.message + '). The first install\n'
          + '        of a new worker routinely runs before any page is controlled; refusing it\n'
          + '        because nobody was listening strands the phone on the previous worker.');
      } else ok('an install with no client at all still settles (the worker activates)');
      const missing = SW_CORE.filter((u) => !h.has(h.opened[0], u));
      if (missing.length) {
        no('B13', 'with no client listening the worker stored only ' + (SW_CORE.length - missing.length)
          + ' of ' + SW_CORE.length + ' CORE entries. The report must cost the precache nothing.');
      } else ok('...and all ' + SW_CORE.length + ' CORE entries are still stored');
      if (h.posted().length !== 0) no('B13', 'a report was posted to a client list that was empty');
      const rec = h.self.ezikPrecacheFailures || [];
      if (rec.length !== 0) {
        no('B13', 'an empty client list was recorded as ' + rec.length + ' precache failure(s).\n'
          + '        Nobody listening is not a precache problem and must not read as one.');
      } else ok('...and "nobody listening" is not recorded as a failure');
      const st = h.storage();
      if (!st || st.announced !== 0) {
        no('B13', 'an empty audience was recorded as ' + JSON.stringify(st && st.announced)
          + ' rather than 0 -- a page reading this cannot tell "nobody was there" from "we never tried".');
      } else ok('an empty audience is recorded as 0, distinctly from "unavailable"');
    }

    // ---- STATE 4b: the browser exposes no clients.matchAll at all. ----------
    {
      const nav = swNav(WIDE13);
      const h = swLoad(swPath, () => Promise.resolve(swRes('NET')), null, nav.navigator, { matchAll: false });
      const inst = h.install();
      let rejected = null;
      for (const w of inst.waits) { await Promise.resolve(w).catch((e) => { rejected = e; }); }
      const st = h.storage();
      if (rejected) {
        no('B13', 'a browser with no clients.matchAll made install REJECT (' + rejected.message
          + '). The push channel has to be optional or it is a new way to strand a phone.');
      } else ok('a browser with no clients.matchAll still settles install');
      const missing = SW_CORE.filter((u) => !h.has(h.opened[0], u));
      if (missing.length) no('B13', 'a missing clients API cost the precache ' + missing.length + ' entr(y/ies)');
      else ok('...and stores all ' + SW_CORE.length + ' CORE entries');
      if (!st || st.announced !== 'unavailable') {
        no('B13', 'the absent channel was recorded as ' + JSON.stringify(st && st.announced)
          + ', not "unavailable" -- so a page cannot tell a silent worker from a mute browser.');
      } else ok('the absent channel is recorded as "unavailable", not as a failure');
    }

    // ---- STATE 4c: one client throws on postMessage. The others still get it. ----
    {
      const nav = swNav(WIDE13);
      const h = swLoad(swPath, () => Promise.resolve(swRes('NET')), null, nav.navigator,
        { count: 3, throwsOn: 'c1' });
      const inst = h.install();
      let rejected = null;
      for (const w of inst.waits) { await Promise.resolve(w).catch((e) => { rejected = e; }); }
      if (rejected) no('B13', 'one dead client REJECTED install: ' + rejected.message);
      const got = h.posted().map((p) => p.client).sort();
      if (JSON.stringify(got) !== JSON.stringify(['c0', 'c2'])) {
        no('B13', 'with one client throwing, the report reached ' + JSON.stringify(got)
          + ' instead of ["c0","c2"]. A page that navigated away mid-install must not cost the\n'
          + '        pages still open their copy.');
      } else ok('a client that throws on postMessage costs only itself the report');
      const st = h.storage();
      if (!st || st.announced !== 2) {
        no('B13', 'the announcement count is ' + JSON.stringify(st && st.announced)
          + ' where 2 of 3 clients were actually reached -- the record must count deliveries,\n'
          + '        not attempts, or it reports a page as told when it was not.');
      } else ok('...and the record counts deliveries, not attempts (2 of 3)');
    }

    // ---- STATE 5: the QUOTA SKIP announces too. -----------------------------
    // The skip is the state a reader most needs told about -- nothing was written at all -- and
    // it produces zero per-entry failures, so a report gated on `failed > 0` would be silent in
    // exactly the case it exists for.
    {
      const nav = swNav(NARROW13);
      const h = swLoad(swPath, () => Promise.resolve(swRes('NET')), null, nav.navigator, { count: 1 });
      const inst = h.install();
      for (const w of inst.waits) { await Promise.resolve(w).catch(() => {}); }
      const reports = reportsOf(h);
      if (reports.length !== 1) {
        no('B13', 'a quota-skipped install sent ' + reports.length + ' report(s). Nothing was\n'
          + '        written at all, which is the one outcome a reader cannot afford not to hear.');
      } else if (reports[0].skipped !== 'quota') {
        no('B13', 'the skipped install reported skipped=' + JSON.stringify(reports[0].skipped));
      } else if (reports[0].failed !== 0) {
        no('B13', 'the skipped install reported ' + reports[0].failed + ' per-entry failure(s); the\n'
          + '        skip REPLACES that list, and a page shown seven failures would hunt seven files.');
      } else ok('a quota-skipped install still reports, and reports the skip rather than seven failures');
    }
  }

  // -- B15 the 604 printed mushaf pages: their OWN store, capped (item 33) ---
  //
  // MEASURED BEFORE: sw.js named assets/madina-hafs nowhere at all, so every one of the 604 page
  // scans fell through to the generic same-origin cache-first arm and was written into CACHE --
  // unbounded, un-evicted, never estimated, and swept by activate on every version bump.
  //
  // B10 seals sw.js, and a seal would have blessed that forever. So this section RUNS the worker,
  // the same way B11 does, and asks it what it DOES with a page request. Three things are
  // asserted because three separate defects were measured, and each of them is a state the
  // harness drives rather than a line of source anybody quotes.
  console.log('\n-- B15 service worker: the printed mushaf pages are capped (item 33) --');
  if (!fs.existsSync(swPath)) {
    no('B15', SW_FILE + ' is ABSENT -- the mushaf page policy cannot be executed');
  } else {
    // Room for everything, so nothing below is passing only because an estimate declined.
    const WIDE15 = { quota: 4096 * 1024 * 1024, usage: 1024 * 1024 };
    // Less free than MUSHAF_MIN_FREE, and deliberately not zero: the state this drives is
    // "there is room for the page and it must still not be taken", not "the disk is full".
    const TIGHT15 = { quota: 100 * 1024 * 1024, usage: 80 * 1024 * 1024 };

    // (1) A PAGE GOES TO THE DEDICATED STORE, NOT THE SHIPMENT STORE.
    {
      const nav = swNav(WIDE15);
      const h = swLoad(swPath, () => Promise.resolve(swRes('PAGE')), null, nav.navigator);
      const d = h.dispatch(swPageUrl(1));
      const body = await swBody(d.responded);
      await swSettle(d.waits);
      if (!d.responded) {
        no('B15', swPageUrl(1) + ' is not handled by the worker at all -- it still falls through\n'
          + '        to the generic cache-first arm, which is the whole defect item 33 measured.');
      } else if (body !== 'PAGE') {
        no('B15', 'the page was not served from the network on a cold store (got '
          + JSON.stringify(body) + ')');
      } else if (!h.has(SW_MUSHAF_CACHE, swPageUrl(1))) {
        no('B15', 'the page was NOT stored in ' + JSON.stringify(SW_MUSHAF_CACHE) + '. The stores\n'
          + '        the worker opened were ' + JSON.stringify(h.stores()) + '.');
      } else if (h.has(SW_CACHE, swPageUrl(1))) {
        no('B15', 'the page was ALSO written into ' + JSON.stringify(SW_CACHE) + '. A copy in the\n'
          + '        shipment store is swept on the next bump and is exactly the megabytes item 33\n'
          + '        exists to stop re-downloading.');
      } else {
        ok('a printed page is stored in "' + SW_MUSHAF_CACHE + '", not in the shipment store');
      }
      // Cache-first, and it must not revalidate: a scan of a printed page cannot change.
      const h2 = swLoad(swPath, () => Promise.resolve(swRes('NET')), null, nav.navigator);
      h2.seedStore(SW_MUSHAF_CACHE);
      h2.seed(SW_MUSHAF_CACHE, swPageUrl(1), 'STORED');
      const before2 = h2.fetches();
      const d2 = h2.dispatch(swPageUrl(1));
      const body2 = await swBody(d2.responded);
      await swSettle(d2.waits);
      if (body2 !== 'STORED') {
        no('B15', 'a stored page was not served from the store (got ' + JSON.stringify(body2) + ')');
      } else if (h2.fetches() !== before2) {
        no('B15', 'a stored page still issued ' + (h2.fetches() - before2) + ' network fetch(es).\n'
          + '        These files are sealed scans; revalidation can only ever spend a reader\'s\n'
          + '        data plan to re-download bytes that cannot have changed.');
      } else {
        ok('...and a stored page is served from it with ZERO revalidation fetches');
      }
    }

    // (2) PAGE 61 EVICTS PAGE 1. The ceiling holds and the OLDEST is what goes.
    {
      const nav = swNav(WIDE15);
      const h = swLoad(swPath, () => Promise.resolve(swRes('PAGE')), null, nav.navigator);
      for (let n = 1; n <= SW_MUSHAF_CAP + 1; n++) {
        const d = h.dispatch(swPageUrl(n));
        await swBody(d.responded);
        await swSettle(d.waits);
      }
      const held = [];
      for (let n = 1; n <= SW_MUSHAF_CAP + 1; n++) if (h.has(SW_MUSHAF_CACHE, swPageUrl(n))) held.push(n);
      if (held.length > SW_MUSHAF_CAP) {
        no('B15', 'after reading ' + (SW_MUSHAF_CAP + 1) + ' pages the store holds ' + held.length
          + '. The ceiling is ' + SW_MUSHAF_CAP + ' pages; a store that only grows is the state\n'
          + '        measured before item 33, where paging the whole book wrote 66012516 bytes.');
      } else if (held.length < SW_MUSHAF_CAP) {
        no('B15', 'the store holds only ' + held.length + ' of ' + SW_MUSHAF_CAP + ' pages.\n'
          + '        An eviction rule that evicts more than it must is a reader re-downloading\n'
          + '        pages they already had; the ceiling is a ceiling, not a target.');
      } else if (held.indexOf(1) !== -1) {
        no('B15', 'page 1 survived and the store is full -- so the ceiling dropped something\n'
          + '        other than the LEAST RECENTLY USED entry. Held: ' + JSON.stringify(held));
      } else if (held.indexOf(SW_MUSHAF_CAP + 1) === -1) {
        no('B15', 'page ' + (SW_MUSHAF_CAP + 1) + ' -- the one just read -- is not in the store.\n'
          + '        A full store that refuses the NEW page instead of evicting the oldest has\n'
          + '        frozen the reader out of exactly the page they are looking at.');
      } else {
        ok('page ' + (SW_MUSHAF_CAP + 1) + ' evicts page 1: the store holds ' + SW_MUSHAF_CAP
          + ' pages, least-recently-used first out');
      }
      // The record must say so. A silent eviction is indistinguishable from a silent failure.
      const st = h.storage();
      const ms = st && st.mushaf;
      if (!ms || ms.evicted < 1) {
        no('B15', 'the eviction was not recorded (mushaf=' + JSON.stringify(ms) + '). Item 93 and\n'
          + '        93-b opened a channel precisely so a store that quietly loses entries cannot.');
      } else if (ms.failed !== 0) {
        no('B15', 'the run recorded ' + ms.failed + ' storage failure(s) on a healthy disk: '
          + JSON.stringify(ms.reason));
      } else {
        ok('...and the eviction is counted on the item 93 channel, with zero failures');
      }
    }

    // (3) A VERSION BUMP MUST NOT TAKE THE PAGES. The whole point of the separate store.
    {
      const nav = swNav(WIDE15);
      const h = swLoad(swPath, () => Promise.resolve(swRes('NET')), null, nav.navigator);
      // The state a bump leaves behind: the PREVIOUS shipment store, still full, beside the
      // page store. The worker's own CACHE is the new one.
      const STALE = 'ezik-v0-superseded';
      h.seed(STALE, '/', 'OLD SHELL');
      h.seed(SW_MUSHAF_CACHE, swPageUrl(7), 'PAGE 7');
      const act = h.activate();
      if (act.missing) {
        no('B15', SW_FILE + ' registered no activate listener -- the sweep cannot be executed');
      } else {
        await swSettle(act.waits);
        const gone = !h.has(STALE, '/') || h.stores().indexOf(STALE) === -1;
        if (!gone) {
          no('B15', 'activate did NOT delete the superseded shipment store ' + JSON.stringify(STALE)
            + '.\n        The sweep is why a bump reaches a returning reader at all; item 33 narrows\n'
            + '        it by one name and must not disarm it.');
        } else if (h.stores().indexOf(SW_MUSHAF_CACHE) === -1 || !h.has(SW_MUSHAF_CACHE, swPageUrl(7))) {
          no('B15', 'activate DELETED ' + JSON.stringify(SW_MUSHAF_CACHE) + ' along with the\n'
            + '        superseded store. That is the defect item 33 exists to close: every ship threw\n'
            + '        away every page the reader had downloaded, of files that cannot change.\n'
            + '        Deleted: ' + JSON.stringify(h.deleted()));
        } else {
          ok('a version bump sweeps the superseded store and LEAVES "' + SW_MUSHAF_CACHE + '" intact');
        }
      }
    }

    // (4) NEARLY FULL DISK: the reader still gets the page, and nothing is written.
    {
      const nav = swNav(TIGHT15);
      const h = swLoad(swPath, () => Promise.resolve(swRes('PAGE')), null, nav.navigator);
      let raised = null;
      const d = h.dispatch(swPageUrl(3));
      const body = await swBody(d.responded).catch((e) => { raised = e; return undefined; });
      for (const w of d.waits) await Promise.resolve(w).catch((e) => { raised = e; });
      const st = h.storage();
      const ms = st && st.mushaf;
      if (raised) {
        no('B15', 'a nearly-full disk raised an error at the page: ' + raised.message
          + '.\n        The reader asked for a page of the Qur\'an, not for a storage report.');
      } else if (body !== 'PAGE') {
        no('B15', 'a nearly-full disk cost the reader the page itself (got ' + JSON.stringify(body)
          + '). The estimate governs the WRITE; the read is not its business.');
      } else if (h.has(SW_MUSHAF_CACHE, swPageUrl(3))) {
        no('B15', 'the page was stored anyway on a disk with less free space than the floor.\n'
          + '        An estimate that does not change what happens is not a check.');
      } else if (!ms || ms.skipped !== 1) {
        no('B15', 'the declined write was not recorded (mushaf=' + JSON.stringify(ms) + ').');
      } else if (nav.calls.estimate < 1) {
        no('B15', 'navigator.storage.estimate() was never called -- the decision was taken\n'
          + '        without ever asking the browser how much room there is.');
      } else {
        ok('a nearly-full disk still serves the page, stores nothing, raises nothing, and says so');
      }
    }

    // (5) NOTHING IS SWALLOWED. A rejected write is counted and given a reason.
    {
      const nav = swNav(WIDE15);
      const h = swLoad(swPath, () => Promise.resolve(swRes('PAGE')), null, nav.navigator,
        undefined, () => 'quota');
      let raised = null;
      const d = h.dispatch(swPageUrl(9));
      const body = await swBody(d.responded).catch((e) => { raised = e; return undefined; });
      for (const w of d.waits) await Promise.resolve(w).catch((e) => { raised = e; });
      const ms = h.storage() && h.storage().mushaf;
      if (raised) {
        no('B15', 'a rejected cache write reached the page as an error: ' + raised.message);
      } else if (body !== 'PAGE') {
        no('B15', 'a rejected cache write cost the reader the page (got ' + JSON.stringify(body) + ')');
      } else if (!ms || ms.failed !== 1) {
        no('B15', 'a rejected page write was SWALLOWED (mushaf=' + JSON.stringify(ms) + ').\n'
          + '        `catch(() => {})` on this path is the defect item 93 was raised to end, and a\n'
          + '        page store is the one place in this worker it had never been closed.');
      } else if (ms.reason !== 'quota') {
        no('B15', 'the rejected write was recorded with reason ' + JSON.stringify(ms.reason)
          + '. A full disk and a dead tunnel ask opposite things of the reader.');
      } else {
        ok('a rejected page write is counted and named on the item 93 channel, and costs no reader');
      }
    }
  }

  // -- B16 the offline package's contract with the page (round 25, A-4) ----
  //
  // The page offers "download this juz". It may only do that if it can state the eviction rule
  // and refuse to start when the disk cannot hold the juz -- and BOTH numbers have to come from
  // this worker, because a second copy of a ceiling is a ceiling that drifts. So the worker now
  // publishes its policy on the channel item 93-B opened, and this asks it to.
  //
  // THE CONFLICT CHECK THE ROUND DEMANDED IS FIXED HERE AS AN ASSERTION rather than left as a
  // measurement somebody took once: the ceiling is re-derived against the LARGEST juz in the
  // shipped layout on every run. If a future edit lowers the cap under a juz, the button would
  // start evicting the front of the juz while still downloading the back of it -- finishing at
  // 100% with an incomplete juz on the device, which is the exact shape of lie this item bans.
  console.log('\n-- B16 offline package: the policy the page is answered with (A-4) --');
  if (!fs.existsSync(SW_FILE)) no('B16', SW_FILE + ' is ABSENT -- the policy cannot be read');
  else {
    const w = swLoad(SW_FILE, () => Promise.resolve(swRes('x')), null,
      { storage: { estimate: () => Promise.resolve({ quota: 1e9, usage: 0 }) } }, null, null);
    const m = w.message({ ezik: 'precache-status' });
    if (m.missing) no('B16', 'the worker registered no message listener, so the page can ask it nothing');
    else if (!m.reply || !m.reply.storage) no('B16', 'the pull channel answered without a storage record');
    else {
      const pol = m.reply.storage.mushafPolicy;
      if (!pol || typeof pol.cap !== 'number' || typeof pol.minFree !== 'number') {
        no('B16', 'the worker publishes no mushaf policy, so the page can only guess the ceiling '
          + 'and the floor it must respect: ' + JSON.stringify(pol));
      } else {
        if (pol.cap === SW_MUSHAF_CAP) ok('the worker publishes its page ceiling (' + pol.cap + ') to the page');
        else no('B16', 'the published ceiling is ' + pol.cap + ' but the worker enforces ' + SW_MUSHAF_CAP);
        if (pol.minFree > 0) ok('...and the free-space floor it declines below (' + pol.minFree + ' bytes)');
        else no('B16', 'the published floor is not a positive number of bytes: ' + pol.minFree);

        // THE CAP AGAINST THE LARGEST JUZ, re-derived from the shipped layout every run.
        let biggest = 0, biggestJuz = 0;
        try {
          const layout = JSON.parse(fs.readFileSync('mushaf-layout.json', 'utf8'));
          const JUZ1 = { 1: '1:1', 2: '2:142', 3: '2:253', 4: '3:92', 5: '4:24', 6: '4:148',
            7: '5:82', 8: '6:111', 9: '7:88', 10: '8:41', 11: '9:93', 12: '11:6', 13: '12:53',
            14: '15:1', 15: '17:1', 16: '18:75', 17: '21:1', 18: '23:1', 19: '25:21', 20: '27:56',
            21: '29:46', 22: '33:31', 23: '36:28', 24: '39:32', 25: '41:47', 26: '46:1',
            27: '51:31', 28: '58:1', 29: '67:1', 30: '78:1' };
          const wordPage = {};
          for (const pg of layout.p) {
            for (const ln of pg.l) {
              if (ln.t !== 't' || !ln.w) continue;
              for (const loc of ln.w) if (!(loc in wordPage)) wordPage[loc] = pg.n;
            }
          }
          const total = layout.pages;
          const start = {};
          for (let j = 1; j <= 30; j++) start[j] = wordPage[JUZ1[j] + ':1'];
          for (let j = 1; j <= 30; j++) {
            const a = start[j];
            const b = j < 30 ? start[j + 1] - 1 : total;
            if (!a || !b) { biggest = 0; break; }
            const n = b - a + 1;
            if (n > biggest) { biggest = n; biggestJuz = j; }
          }
        } catch (e) { biggest = 0; }
        if (!biggest) {
          no('B16', 'the juz page ranges could not be derived from mushaf-layout.json, so the '
            + 'ceiling could not be checked against a juz at all');
        } else if (pol.cap < biggest) {
          no('B16', 'THE CEILING IS UNDER A JUZ: the store holds ' + pol.cap + ' pages but juz '
            + biggestJuz + ' is ' + biggest + ' pages. A download of it would evict its own '
            + 'front while fetching its back and finish claiming a juz that is not there.');
        } else {
          ok('the ceiling (' + pol.cap + ' pages) holds the LARGEST juz (' + biggestJuz + ', '
            + biggest + ' pages) whole');
        }
      }
      // THE ESTIMATE MUST NOT BE ABLE TO UNDER-ESTIMATE. The page refuses to start a download
      // it cannot fit, and it sizes the juz as pageCount x JUZ_DL_PAGE_BYTES. If that constant
      // ever slips below the LARGEST page actually shipped, the refusal stops being safe: a juz
      // of heavy pages would be waved through and then run the disk out mid-download.
      let perPage = 0;
      try {
        const m = fs.readFileSync('app.jsx', 'utf8').match(/const JUZ_DL_PAGE_BYTES = ([0-9]+);/);
        perPage = m ? Number(m[1]) : 0;
      } catch (e) { perPage = 0; }
      let maxPage = 0, pageFiles = 0;
      try {
        const dir = 'assets/madina-hafs';
        for (const f of fs.readdirSync(dir)) {
          if (!/^page-[0-9][0-9][0-9]\.webp$/.test(f)) continue;
          pageFiles++;
          const sz = fs.statSync(dir + '/' + f).size;
          if (sz > maxPage) maxPage = sz;
        }
      } catch (e) { maxPage = 0; }
      if (!perPage) no('B16', 'the page-size estimate JUZ_DL_PAGE_BYTES was not found in app.jsx');
      else if (!pageFiles) no('B16', 'no shipped page files were found to measure the estimate against');
      else if (perPage < maxPage) {
        no('B16', 'the per-page estimate is ' + perPage + ' but the largest shipped page is '
          + maxPage + ' -- the refusal can be waved through on a juz it cannot fit');
      } else {
        ok('the per-page estimate (' + perPage + ') is at least the largest of the ' + pageFiles
          + ' shipped pages (' + maxPage + '), so it cannot under-estimate a juz');
      }

      // The store's name is what makes the pages survive a ship. A-4 must not have touched it.
      if (fs.readFileSync(SW_FILE, 'utf8').indexOf("'" + SW_MUSHAF_CACHE + "'") !== -1) {
        ok('the page store still carries its own unversioned name (' + SW_MUSHAF_CACHE + ')');
      } else {
        no('B16', 'the mushaf store name moved; every page a reader already paid for is orphaned');
      }
    }
  }

  // -- B17 the new mushaf, offline (item 4 of the register, part two) ---------
  //
  // MEASURED BEFORE: sw.js named mushaf-lab nowhere. app.jsx opens the new reader as an iframe of
  // /mushaf-lab/index.html, so with no network that navigation found no stored document and the
  // mushaf did not open at all; and the reader's own "download this surah" wrote three stores
  // (lab-pages, lab-static, lab-audio) that this worker never reads and that activate deleted on
  // every store-name bump. This section runs the worker the way B11 and B15 do, reads the reader
  // the way a browser would request it, and asserts six things:
  //   (1) activate keeps the downloads store;
  //   (2) a page stored ONLY in the downloads store is served with the network dead;
  //   (3) a geometry file stored ONLY there is served with the network dead;
  //   (4) IDLE covers every same-origin asset mushaf-lab/index.html references and every file the
  //       reader fetches by a literal name -- parsed from the files, not typed here;
  //   (5) the downloads store is the same string in sw.js and mushaf-lab/app.js;
  //   (6) the reader's own offline paths exist: a stored whole tafsir or translation file answers
  //       an ayah when its per-ayah fetch fails, and a stored ayah plays from a blob URL.
  // And a seventh, because the sheet shows sizes before a download starts: the size table the
  // reader reads (mushaf-lab/data/offline-sizes.json) is what the tree measures.
  console.log('\n-- B17 the new mushaf opens and reads offline (item 4 of the register) --');
  {
    const SW_DL_CACHE = 'ezik-mushaf-downloads-v1';
    const LAB = 'mushaf-lab';
    const labPath = (f) => path.join(__dirname, LAB, f);
    const swSrc17 = fs.existsSync(swPath) ? fs.readFileSync(swPath, 'utf8') : '';
    const labSrc = fs.existsSync(labPath('app.js')) ? fs.readFileSync(labPath('app.js'), 'utf8') : '';
    const labHtml = fs.existsSync(labPath('index.html')) ? fs.readFileSync(labPath('index.html'), 'utf8') : '';
    const deadNet = () => Promise.reject(swAddError('network'));
    if (!swSrc17 || !labSrc || !labHtml) {
      no('B17', 'sw.js, mushaf-lab/app.js or mushaf-lab/index.html is ABSENT -- nothing to execute');
    } else {
      // (8) Compact top bar, bookmark wiring, and the existing exit decision.
      try {
        const labCss = fs.readFileSync(labPath('style.css'), 'utf8');
        const checks = await assertMushafTopbar(labHtml, labSrc, labCss);
        ok('lab top bar: ' + checks + ' DOM/store/navigation checks, KEEP_BACK_ARROW=yes');
        if (process.argv.includes('--mutants')) {
          const mutants = [
            ['old title', labHtml.replace('</header>', '<h1 id="surahTitle">title</h1></header>'), labSrc, labCss],
            ['old previous button', labHtml.replace('</header>', '<button id="prevBtn">previous</button></header>'), labSrc, labCss],
            ['duplicate toggle', labHtml.replace('</header>', '<button id="pageBookmarkBtn"></button></header>'), labSrc, labCss],
            ['missing back', labHtml.replace(/<button[^>]*id="exitBtn"[\s\S]*?<\/button>/, ''), labSrc, labCss],
            ['wrong store action', labHtml, labSrc.replace("toggleBookmark('p', cur)", "toggleBookmark('a', '2:1')"), labCss],
            ['stale store state', labHtml, labSrc.replace("if (k === 'bm') refreshBookmarks();", ''), labCss],
            ['stale page state', labHtml, labSrc.replace("    updatePageBookmark();", ''), labCss],
            ['no parent bridge', labHtml, labSrc.replace("toEzik({ type: 'mushaf-lab:bookmark'", "(() => {})({ type: 'mushaf-lab:bookmark'"), labCss],
            ['unfilled saved icon', labHtml, labSrc, labCss.replace('fill: currentColor;', 'fill: none;')],
            ['propagating icon tap', labHtml, labSrc.replace('e.stopPropagation(); togglePageBookmark();', 'togglePageBookmark();'), labCss]
          ];
          let killed = 0;
          for (const [name, html, src, css] of mutants) {
            if (html === labHtml && src === labSrc && css === labCss) throw new Error('mutant did not change input: ' + name);
            try { await assertMushafTopbar(html, src, css); }
            catch (e) { killed++; continue; }
            throw new Error('surviving top-bar mutant: ' + name);
          }
          ok('lab top bar mutants killed ' + killed + '/' + mutants.length);
        }
      } catch (e) { no('B17', 'lab top bar: ' + e.message); }

      // (1) ACTIVATE KEEPS THE DOWNLOADS STORE. A stale shipment store beside it is the control:
      // an activate that swept nothing at all would otherwise pass this.
      {
        const h = swLoad(swPath, deadNet, null, undefined);
        h.seedStore(SW_DL_CACHE); h.seed(SW_DL_CACHE, swPageUrl(7), 'KEPT');
        h.seedStore('ezik-v1'); h.seedStore(SW_CACHE);
        const act = h.activate();
        await swSettle(act.waits);
        if (act.missing) no('B17', SW_FILE + ' registered no activate listener');
        else if (h.stores().indexOf(SW_DL_CACHE) === -1 || !h.has(SW_DL_CACHE, swPageUrl(7))) {
          no('B17', 'activate DELETED "' + SW_DL_CACHE + '". Everything in it is there because the reader\n'
            + '        pressed a download button; a ship must not take it back. Deleted: ' + JSON.stringify(h.deleted()));
        } else if (h.stores().indexOf('ezik-v1') !== -1) {
          no('B17', 'activate swept nothing at all -- the stale store "ezik-v1" survived, so (1) proves nothing');
        } else {
          ok('activate keeps "' + SW_DL_CACHE + '" and still sweeps the stale shipment store');
        }
      }

      // (2) A PAGE IN THE DOWNLOADS STORE ONLY, NETWORK DEAD.
      {
        const h = swLoad(swPath, deadNet, null, undefined);
        h.seed(SW_DL_CACHE, swPageUrl(5), 'DLPAGE');
        const d = h.dispatch(swPageUrl(5));
        const body = await swBody(d.responded);
        await swSettle(d.waits);
        if (!d.responded) no('B17', swPageUrl(5) + ' is not handled by the worker at all');
        else if (body !== 'DLPAGE') {
          no('B17', 'a page stored only in "' + SW_DL_CACHE + '" was NOT served with the network dead (got '
            + JSON.stringify(body) + '). A downloaded juz would show blank pages offline.');
        } else ok('a page stored only in the downloads store is served with no network');
      }

      // (3) A GEOMETRY FILE IN THE DOWNLOADS STORE ONLY, NETWORK DEAD. The URL carries the build
      // query exactly as the reader requests it.
      {
        const h = swLoad(swPath, deadNet, null, undefined);
        const geo = '/' + LAB + '/geometry/005.json?v=B17';
        h.seed(SW_DL_CACHE, geo, 'DLGEO');
        const d = h.dispatch(geo);
        const body = await swBody(d.responded);
        await swSettle(d.waits);
        if (!d.responded) no('B17', geo + ' is not handled by the worker at all');
        else if (body !== 'DLGEO') {
          no('B17', 'a geometry file stored only in "' + SW_DL_CACHE + '" was NOT served with the network dead (got '
            + JSON.stringify(body) + '). A downloaded page would open with no ayah layer: no menu, no copy.');
        } else ok('a geometry file stored only in the downloads store is served with no network');
      }

      // (4) IDLE COVERS THE READER. Both sides are parsed: the IDLE array out of sw.js, and out of
      // mushaf-lab/ every same-origin href/src index.html names plus every literal fetch('...') in
      // app.js and every literal path in its boot array, each resolved against the page the way a
      // browser resolves it. The two mushaf files at the root are part of that boot.
      {
        const at = swSrc17.indexOf('const IDLE = [');
        const idle = at === -1 ? [] : (swSrc17.slice(at, swSrc17.indexOf('];', at)).match(/'[^']+'/g) || []).map((s) => s.slice(1, -1));
        const base = SW_ORIGIN + '/' + LAB + '/index.html';
        const want = new Set();
        const add = (ref) => {
          if (!ref || /^(?:[a-z]+:|\/\/|#)/i.test(ref)) return;       // other origins and fragments
          const u = new URL(ref, base);
          if (u.origin === SW_ORIGIN) want.add(u.pathname + u.search);
        };
        want.add('/' + LAB + '/index.html');
        for (const m of labHtml.matchAll(/\b(?:href|src)\s*=\s*"([^"]+)"/g)) add(m[1]);
        for (const m of labSrc.matchAll(/\bfetch\(\s*'([^']+)'/g)) add(m[1]);
        const bootAt = labSrc.indexOf('async function boot()');
        const boot = bootAt === -1 ? '' : labSrc.slice(bootAt, labSrc.indexOf('buildIndexes();', bootAt));
        // Inside Ezik the reader takes the left arm of each IN_EZIK ternary; that arm is what boots.
        const bootInEzik = boot.replace(/IN_EZIK\s*\?\s*('[^']*')\s*:\s*'[^']*'/g, '$1');
        for (const m of bootInEzik.matchAll(/'([^']+\.json)'/g)) add(m[1]);
        const missing = Array.from(want).filter((u) => idle.indexOf(u) === -1).sort();
        if (!idle.length) no('B17', 'the IDLE list could not be read out of ' + SW_FILE);
        else if (!boot || want.size < 8) {
          no('B17', 'the reader\'s boot could not be parsed out of mushaf-lab/app.js (' + want.size + ' URL(s) found)'
            + ' -- (4) would be measuring nothing');
        } else if (missing.length) {
          no('B17', 'the worker does not warm ' + missing.join(', ') + '.\n'
            + '        The reader requests it, so with no network it is missing and the mushaf does not open\n'
            + '        (or opens without it). Add it to IDLE in ' + SW_FILE + ' exactly as requested, query included.');
        } else {
          ok('IDLE warms all ' + want.size + ' same-origin files the new mushaf references or boots from, as requested');
        }
        // And the navigation the iframe makes must fall back to the reader's document, not Ezik's.
        const h = swLoad(swPath, deadNet, null, undefined);
        h.seed(SW_CACHE, '/' + LAB + '/index.html', 'LABSHELL');
        h.seed(SW_CACHE, '/', 'EZIKSHELL');
        const d = h.dispatch('/' + LAB + '/index.html', 'navigate');
        const body = await swBody(d.responded);
        // A navigation inside the reader's directory that is not itself stored (its bare directory)
        // must still get the reader, never Ezik's own shell drawn inside the mushaf frame.
        const d2 = h.dispatch('/' + LAB + '/', 'navigate');
        const body2 = await swBody(d2.responded);
        if (body !== 'LABSHELL') {
          no('B17', 'with no network the iframe navigation to /' + LAB + '/index.html was answered with '
            + JSON.stringify(body) + ', not the stored reader');
        } else if (body2 !== 'LABSHELL') {
          no('B17', 'with no network a navigation to /' + LAB + '/ was answered with ' + JSON.stringify(body2)
            + ' -- Ezik\'s shell inside the mushaf frame is not an offline mushaf');
        } else ok('with no network the mushaf frame is answered with the stored reader document');
      }

      // (5) ONE STORE NAME, DECLARED ONCE ON EACH SIDE.
      {
        const swName = (swSrc17.match(/const DOWNLOADS_CACHE = '([^']+)';/) || [])[1];
        const labName = (labSrc.match(/const DL_STORE = '([^']+)';/) || [])[1];
        const once = (src, s) => src.split("'" + s + "'").length - 1;
        if (!swName || !labName) {
          no('B17', 'the downloads store is not declared (sw.js DOWNLOADS_CACHE=' + JSON.stringify(swName)
            + ', mushaf-lab/app.js DL_STORE=' + JSON.stringify(labName) + ')');
        } else if (swName !== labName) {
          no('B17', 'the reader writes its downloads to "' + labName + '" and the worker reads "' + swName
            + '" -- every download would be invisible offline');
        } else if (swName !== SW_DL_CACHE) {
          no('B17', 'the downloads store was renamed to "' + swName + '" -- every download a reader already made is orphaned');
        } else if (once(swSrc17, swName) !== 1 || once(labSrc, labName) !== 1) {
          no('B17', 'the store name is written ' + once(swSrc17, swName) + ' time(s) in sw.js and ' + once(labSrc, labName)
            + ' in mushaf-lab/app.js; it must be declared once on each side and referenced by name');
        } else ok('the downloads store is "' + swName + '" on both sides, declared once in each');
      }

      // (6) THE READER'S OWN OFFLINE PATHS, EXECUTED. The functions are lifted out of
      // mushaf-lab/app.js by name and run against a domesticated Cache API -- no DOM, no network.
      {
        const lift = (name) => {
          const at = labSrc.search(new RegExp('(?:async )?function ' + name + '\\('));
          if (at === -1) return null;
          let i = labSrc.indexOf('{', at), depth = 0;
          for (; i < labSrc.length; i++) {
            if (labSrc[i] === '{') depth++;
            else if (labSrc[i] === '}' && --depth === 0) return labSrc.slice(at, i + 1);
          }
          return null;
        };
        const constLine = (name) => (labSrc.match(new RegExp('const ' + name + ' = [^\\n]+')) || [])[0];
        const need = ['getJson', 'fromStoredWhole', 'storedJson', 'storedAudio', 'startTrack', 'stopPlay', 'releaseBlob'];
        const got = {};
        need.forEach((n) => { got[n] = lift(n); });
        const consts = ['DL_STORE', 'TAFSIR_BASES', 'TRANS_BASES', 'TAFSIR_WHOLE', 'TRANS_WHOLE', 'textCache', 'textWhole'].map(constLine);
        const absent = need.filter((n) => !got[n]);
        if (absent.length || consts.some((c) => !c)) {
          no('B17', 'the reader\'s offline paths are missing from mushaf-lab/app.js: '
            + absent.concat(consts.some((c) => !c) ? ['(a store or base constant)'] : []).join(', '));
        } else {
          const stored = new Map();
          const blobs = [];
          const ctx = {
            caches: { open: () => Promise.resolve({ match: (u) => Promise.resolve(stored.get(String(u))) }) },
            fetch: () => Promise.reject(new TypeError('Failed to fetch (synthetic)')),
            window: { caches: true }, Map: Map, Promise: Promise, JSON: JSON, Array: Array, Number: Number, String: String,
          };
          vm.createContext(ctx);
          vm.runInContext(consts.join('\n') + '\n' + need.map((n) => got[n]).join('\n')
            + '\nthis.__t = { getJson, storedAudio, TAFSIR_BASES, TRANS_BASES };', ctx);
          const t = ctx.__t;
          const resp = (body) => ({ json: () => Promise.resolve(JSON.parse(body)), blob: () => Promise.resolve({ blob: body }) });
          // The two whole-file shapes, as the hosts serve them (measured on the day of this item).
          stored.set(t.TAFSIR_BASES[0] + 'b17-tafsir/2.json',
            JSON.stringify([{ text: 'T-2-1', ayah: 1, surah: 2 }, { text: 'T-2-255', ayah: 255, surah: 2 }]));
          stored.set(t.TRANS_BASES[0] + 'b17-trans.min.json',
            JSON.stringify({ quran: [{ chapter: 1, verse: 1, text: 'X-1-1' }, { chapter: 2, verse: 255, text: 'X-2-255' }] }));
          stored.set('https://everyayah.com/data/B17/002255.mp3', 'MP3');
          for (const [k, v] of Array.from(stored)) stored.set(k, resp(v));
          let tf, tr, au, raised = null;
          try {
            tf = await t.getJson(t.TAFSIR_BASES, 'b17-tafsir/2/255.json');
            tr = await t.getJson(t.TRANS_BASES, 'b17-trans/2/255.json');
            au = await t.storedAudio('https://everyayah.com/data/B17/002255.mp3', true);
          } catch (e) { raised = e; }
          if (raised) no('B17', 'the reader\'s offline text path threw: ' + raised.message);
          else if (!tf || tf.text !== 'T-2-255') {
            no('B17', 'with every host dead, a STORED whole tafsir file did not answer the ayah (got ' + JSON.stringify(tf) + ')');
          } else if (!tr || tr.text !== 'X-2-255') {
            no('B17', 'with every host dead, a STORED whole translation did not answer the ayah (got ' + JSON.stringify(tr) + ')');
          } else ok('with every host dead, a stored whole tafsir file and a stored translation answer the ayah');
          const st = got.startTrack, sp = got.stopPlay + got.releaseBlob;
          if (!au || au.blob !== 'MP3') no('B17', 'a stored ayah is not read back from the downloads store (got ' + JSON.stringify(au) + ')');
          else if (!/storedAudio\([^)]*, true\)/.test(st) || st.indexOf('URL.createObjectURL(') === -1
            || !/P\.audio\.src = P\.blob \|\| /.test(st) || st.indexOf('URL.revokeObjectURL(') === -1
            || sp.indexOf('URL.revokeObjectURL(') === -1) {
            no('B17', 'startTrack no longer plays a stored ayah from a blob URL it revokes (and stopPlay no longer\n'
              + '        revokes the last one). Through the worker instead, the iOS webview would need range requests.');
          } else ok('a stored ayah plays from a blob URL made from the stored response, and every blob URL is revoked');
          const legacy = (labSrc.match(/'lab-(?:pages|static|audio)'/g) || []);
          if (legacy.length) no('B17', 'mushaf-lab/app.js still writes ' + legacy.join(', ') + ' -- stores the worker never reads');
          else ok('nothing in the reader writes lab-pages, lab-static or lab-audio any more');
        }
      }

      // (7) THE SIZE TABLE IS WHAT THE TREE MEASURES.
      {
        let sizes = null;
        try { sizes = JSON.parse(fs.readFileSync(labPath('data/offline-sizes.json'), 'utf8')); } catch (e) { sizes = null; }
        let measured = null;
        try { measured = require('./tools/mushaf-lab-offline-sizes.cjs').measure(__dirname); } catch (e) { measured = null; }
        if (!sizes || !measured) no('B17', 'mushaf-lab/data/offline-sizes.json or its generator could not be read');
        else if (JSON.stringify(sizes.pages) !== JSON.stringify(measured.pages)
          || JSON.stringify(sizes.geometry) !== JSON.stringify(measured.geometry)
          || JSON.stringify(sizes.totals) !== JSON.stringify(measured.totals)) {
          no('B17', 'mushaf-lab/data/offline-sizes.json is not what the tree measures -- the downloads sheet would\n'
            + '        show the reader a wrong size. Re-run: node tools/mushaf-lab-offline-sizes.cjs');
        } else {
          ok('the size table the downloads sheet reads is what the tree measures ('
            + measured.totals.pageFiles + ' pages, ' + measured.totals.geometryFiles + ' geometry files)');
        }
      }
    }
  }

  console.log('\n' + (fail ? 'FAIL' : 'PASS') + '  ' + pass + ' checks passed, ' + fail + ' failed.');
  process.exit(fail ? 1 : 0);
}

const mode = process.argv[2];
if (mode === '--compare' && process.argv[3]) {
  // B11 executes the service worker, so compare() is async. A rejection here must
  // be a loud non-zero exit, never a silent unhandled-rejection warning above a 0.
  compare(process.argv[3]).catch((e) => {
    console.log('  FAIL [B11] the guard itself threw: ' + (e && e.stack ? e.stack : e));
    process.exit(1);
  });
}
else {
  console.error('usage: node quest-bank-integrity-guard.cjs --compare quest-data/kunuz-bank-3147.js');
  process.exit(2);
}
