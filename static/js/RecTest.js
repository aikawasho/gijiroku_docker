// for audio
var audio_sample_rate = null;
var scriptProcessor = null;
var audioContext = null;
// audio data
var audioData = [];
var bufferSize = 1024;
var pushFrag = 0;
var LoudThresh = 0.12;
var silentCount= 0;
const audioLenTh = 50;
const silentTh = 20;
const MFCC_Thresh = 2;
const SilentThresh = 50;
const AudioLengthThresh  =51; 

  // dbにあるかチェックするテキスト (今後修正して事前に定義不要にする予定)
  const speechs = [
    { "text" : "浅野朋美です。" },
   {"text": "今日の東京株式市場で日経平均株価は 小幅続伸 となっています 終値は昨日に比べ 22円72 銭高の11088円 58銭でした。" },
   {"text" : "東証一部の値上がり銘柄数は1146対して値下がりは368 変わらずは 104 銘柄 となっています。"}
  ];
  // dbオブジェクトの作成
let db;

window.onload = function() {
//dbにテキストがあるかどうかチェック
function init() {
  // Loop through the video names one by one
  for(let i = 0; i < speechs.length; i++) {
    // Open transaction, get object store, and get() each video by name
    let objectStore = db.transaction('speechs_os').objectStore('speechs_os');
    let request = objectStore.get(speechs[i].text);
    request.onsuccess = function() {
      // If the result exists in the database (is not undefined)
      if(request.result) {
        // dbにテキストがあれば表示する. ※まだ音声データを読み込むことができていない
        console.log('taking speechss from IDB');
        let url = exportWAV(request.result.audioData);
        audio_sample_rate = request.result.fs;
        displaySpeech(request.result.text,request.result._type, url);
      } else {
        // Fetch the videos from the network
        console.log("not exist")
      }
    };
  }
}

  // Open our database; it is created if it doesn't already exist
  // (see onupgradeneeded below)
  let request = window.indexedDB.open('audios_db', 1);

  // onerror handler signifies that the database didn't open successfully
  request.onerror = function() {
    console.log('Database failed to open');
  };

  // onsuccess handler signifies that the database opened successfully
  request.onsuccess = function() {
    console.log('Database opened succesfully');

    // Store the opened database object in the db variable. This is used a lot below
    db = request.result;
    init();
  };

  // Setup the database tables if this has not already been done
  request.onupgradeneeded = function(e) {

    // Grab a reference to the opened database
    let db = e.target.result;

    // Create an objectStore to store our videos in (basically like a single table)
    // including a auto-incrementing keyaudioDataui
    let objectStore = db.createObjectStore('speechs_os', { keyPath: 'text' });

    // Define what data items the objectStore will contain
    objectStore.createIndex('wav', 'wav', { unique: false });

    console.log('Database setup complete');
  };
};

async function SendData(){
      //ステレオやモノラルのデータを一つの配列samplesに格納
      let mergeBuffers = function (audioData) {
        let sampleLength = 0;
        for (let i = 0; i < audioData.length; i++) {
          sampleLength += audioData[i].length;
        }
        let samples = new Float32Array(sampleLength);
        let sampleIdx = 0;
        for (let i = 0; i < audioData.length; i++) {
          for (let j = 0; j < audioData[i].length; j++) {
            samples[sampleIdx] = audioData[i][j];
            sampleIdx++;
          }
        }
        return samples;
      };
     //samplesはサーバーに送信urlはクライアント側で使う
     samples = mergeBuffers(audioData);
     let url = exportWAV(audioData);
     const AD = audioData;
     data = {'fs':audio_sample_rate,'samples':samples}
     var options = {
                method : 'POST',
                headers : {"Content-Type" : "application/json"},
                body : JSON.stringify(data)}
    const response = await fetch("/",options).then(response => response.json());
    console.log(response['text']);
    console.log("score:%.2f",response["score"]);
    if (response['text'] != "" || response['score'] > MFCC_Thresh) {
         //テキスト, タイプと音声を表示
         displaySpeech(response['text'],response['type'],url);

         //テキストデータ, タイプ, audioDataをdbに保存
         storeSpeech(response['text'],response['type'],audioData,AD)
    } 
   }

async function SendData2() {
     let url = exportWAV(audioData);
     data = {'fs':audio_sample_rate,'samples':audioData}
     var options = { 
                method : 'POST',
                headers : {"Content-Type" : "application/json"},
                body : JSON.stringify(data)}
    const response = await fetch("/",options).then(response => response.json());
    console.log(response['text']);
    console.log("score:%.2f",response["score"]);
    if (response['text'] != "" || response['score'] > MFCCTh) { 
         displaySpeech(response['text'],response['type'],url);
    }   
   }   
//webAudioAPIを使った録音
var onAudioProcess = function (e) {
  var input = e.inputBuffer.getChannelData(0);
  var bufferData = new Float32Array(1024);
  for (var i = 0; i < bufferSize; i++){
        bufferData[i] = input[i];
       }
             
        audioData.push(bufferData);
        
        if ( Math.max(...bufferData) > LoudThresh){
      //        console.log('MAX');
              silentCount = 0; 
        } else {
       // console.log(typeof silentCount);
        silentCount += 1;
        
         if ( silentCount > SilentThresh){
                if (audioData.length > audioMIN ){
                        SendData(audioData);
                        console.log('audio send');
                 }
              
              audioData = [];
             console.log('reset count');
              silentCount = 0; 
         }      
       }
    };

 function MicSuccess( stream ){
      audioContext = new AudioContext();
      audio_sample_rate = audioContext.sampleRate;
    //  console.log(audio_sample_rate);
      scriptProcessor = audioContext.createScriptProcessor(1024, 1, 1);
      var mediastreamsource = audioContext.createMediaStreamSource(stream);
      mediastreamsource.connect(scriptProcessor);
      scriptProcessor.onaudioprocess = onAudioProcess;
      scriptProcessor.connect(audioContext.destination);

      console.log('record start?');
}

//録音スタートの処理
function startREC(){
  $('#rec_btn').css('display','none');
  $('#stop_btn').css('display', 'block');
  audioData = [];
  navigator.mediaDevices.getUserMedia({audio: true}).then(MicSuccess);
}
//録音停止の処理
function stopREC(){
  $('#rec_btn').css('display','block');
  $('#stop_btn').css('display', 'none');
  audioContext.close();
  console.log('send audio');
 }



  // テキスト, タイプ, 音声の表示, 
  function displaySpeech(text,type,url) {
    // Create object URLs out of the blobs
    const audio = document.createElement('audio');
    audio.controls = true;
    const source = document.createElement('source');
    source.src = url;
    source.type = 'audio/wav';
    console.log('タイプは');
    console.log(type);
    let body = document.body
    let input = document.createElement("input");
    input.setAttribute("type", "text");
    input.setAttribute("value", text);
    input.className  = "SpeechText"; 
    body.appendChild(input);
    body.appendChild(audio);
    audio.appendChild(source);
    let select = document.createElement('select');
    select.setAttribute("name","type_label");
    select.size = "1";
    select.className = "SpeechType";
   // select.setAttribute("multiple","");
    var option_task = document.createElement("option");
    var option_none  = document.createElement("option");
    option_task.setAttribute("value", "タスク");
    option_task.appendChild( document.createTextNode("タスク") );
    if (type == 'Task'){
        option_task.setAttribute("selected","");
    }

    option_none.setAttribute("value", "");
    option_none.appendChild( document.createTextNode("") );
    select.appendChild(option_none);
    select.appendChild(option_task);
    body.appendChild(document.createElement("br")); 
    body.appendChild(select);
    body.appendChild(document.createElement("p"));
  }

let exportWAV = function (audioData) {

          var encodeWAV = function(samples, sampleRate) {
            var buffer = new ArrayBuffer(44 + samples.length * 2);
            var view = new DataView(buffer);

            var writeString = function(view, offset, string) {
              for (var i = 0; i < string.length; i++){
                view.setUint8(offset + i, string.charCodeAt(i));
              }
            };

            var floatTo16BitPCM = function(output, offset, input) {
              for (var i = 0; i < input.length; i++, offset += 2){
                var s = Math.max(-1, Math.min(1, input[i]));
                output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
              }
            };

            writeString(view, 0, 'RIFF');  // RIFFヘッダ
            view.setUint32(4, 32 + samples.length * 2, true); // これ以降のファイルサイズ
            writeString(view, 8, 'WAVE'); // WAVEヘッダ
            writeString(view, 12, 'fmt '); // fmtチャンク
            view.setUint32(16, 16, true); // fmtチャンクのバイト数
            view.setUint16(20, 1, true); // フォーマットID
            view.setUint16(22, 1, true); // チャンネル数
            view.setUint32(24, sampleRate, true); // サンプリングレート
            view.setUint32(28, sampleRate * 2, true); // データ速度
            view.setUint16(32, 2, true); // ブロックサイズ
            view.setUint16(34, 16, true); // サンプルあたりのビット数
            writeString(view, 36, 'data'); // dataチャンク
            view.setUint32(40, samples.length * 2, true); // 波形データのバイト数
            floatTo16BitPCM(view, 44, samples); // 波形データ

            return view;
          };

          var mergeBuffers = function(audioData) {
            var sampleLength = 0;
            for (var i = 0; i < audioData.length; i++) {
              sampleLength += audioData[i].length;
            }
            var samples = new Float32Array(sampleLength);
            var sampleIdx = 0;
            for (var i = 0; i < audioData.length; i++) {
              for (var j = 0; j < audioData[i].length; j++) {
                samples[sampleIdx] = audioData[i][j];
                sampleIdx++;
              }
            }
            return samples;
          };

          var dataview = encodeWAV(mergeBuffers(audioData), audio_sample_rate);
          var audioBlob = new Blob([dataview], { type: 'audio/wav' });

          var myURL = window.URL || window.webkitURL;
          var url = myURL.createObjectURL(audioBlob);
          return url;
        };

// ドラッグ&ドロップエリアの取得
var fileArea = document.getElementById('dropArea');

// input[type=file]の取得
var fileInput = document.getElementById('uploadFile');

// ドラッグオーバー時の処理
fileArea.addEventListener('dragover', function(e){
    e.preventDefault();
    fileArea.classList.add('dragover');
});

// ドラッグアウト時の処理
fileArea.addEventListener('dragleave', function(e){
    e.preventDefault();
    fileArea.classList.remove('dragover');
});

// ドロップ時の処理
fileArea.addEventListener('drop', function(e){
    e.preventDefault();
    fileArea.classList.remove('dragover');

    // ドロップしたファイルの取得
    var files = e.dataTransfer.files;

    // 取得したファイルをinput[type=file]へ
    fileInput.files = files;
    
    if(typeof files[0] !== 'undefined') {
        //ファイルが正常に受け取れた際の処理
        FileUpload(files);
    } else {
        //ファイルが受け取れなかった際の処理
    }
});

// input[type=file]に変更があれば実行
// もちろんドロップ以外でも発火します
fileInput.addEventListener('change', function(e){
    var files = e.target.files;
    
    if(typeof files[0] !== 'undefined') {
        // ファイルが正常に受け取れた際の処理

        FileUpload(files);
    } else {
        // ファイルが受け取れなかった際の処理
        console.log("ファイル受け取れない");
    }
}, false);

function FileUpload(Files){
   //  let data = new FormData);
    // data.append('upfile',Files[0],Files[0].name); 
    const fileReader = new FileReader();

    fileReader.onload = () => {
    let samples = []
    var audioChunk;
    const view = new DataView(fileReader.result);
    const samples_list = readWaveData(view) // DataViewから波形データを読み込む
   }
    fileReader.readAsArrayBuffer(Files[0]);
//    const view = new DataView(fileReader.result)
     // const audioBlob = new Blob([view], { type: 'audio/wav' })
     // const myURL = window.URL || window.webkitURL
    // var options = {
      //          method : 'POST',
        //        body :data}
   
  //   fetch("/fileUp",options).then(response => response.json()).then(response => displaySpeech(response['text'],response["type"],response["source"]));
     
}
  // 指定したバイト数分文字列として読み込む
  const readString = (view, offset, length) => {
    let text = ''
    for (let i = 0; i < length; i++) {
      text += String.fromCharCode(view.getUint8(offset + i))
      console.log(text)
    }
    return text
  }

  // ビットレートに合わせてPCMとして読み込む
  const read16bitPCM = (view, offset, length, bitRate,chunnelNum) => {
    let input = [];
    let output = [];
    let chunkOffset = 0;
    let step = 2;
    silentCount = 0;
    const chunksize =2000;
    //最後のチャンクには余りを含める
    const chunkNum = Math.floor(length/chunksize)-1;
    audioData = [];
    if (chunnelNum == 2){
        step = 4;
        }
    for (let j = 0; j < chunkNum; j++) { 
      for (let i = 0; i < chunksize / step; i++) {
        input[i] = view.getInt16(offset + chunkOffset + i * step, true)
        output[i] = parseFloat(input[i]) / parseFloat(2**(bitRate-1))
        if (output[i] > 1.0) output[i] = 1.0
        else if (output[i] < -1.0) output[i] = -1.0
      }
      audioData.push(output);
      chunkOffset += chunksize; 
      if ( Math.max(...output) > LoudThresh){
              silentCount = 0;
        } else {
       // console.log(typeof silentCount);
        silentCount += 1;

         if ( silentCount > SilentThresh){
                if (audioData.length > AudioLengthThresh){
                        SendData();
                        console.log('audio send');
                       // console.log(audioData);
                 }

              audioData = [];
             console.log('reset count');
              silentCount = 0;
         }
       }
     
      output = []
    }
   //最後のチャンク
   for (let i = chunkOffset; i < length / step; i++) {
        input[i-chunkOffset] = view.getInt16(offset + i * step, true)
        output[i-chunkOffset] = parseFloat(input[i-chunkOffset]) / parseFloat(2**(bitRate-1))
        if (output[i-chunkOffset] > 1.0) output[i-chunkOffset] = 1.0 
        else if (output[i-chunkOffset] < -1.0) output[i-chunkOffset] = -1.0
      }   
    audioData.push(output);
        if ( Math.max(...output) > LoudThresh){
      //        console.log('MAX');
              silentCount = 0;
        } else {
       // console.log(typeof silentCount);
        silentCount += 1;

         if ( silentCount > SilentThresh){
                if (audioData.length > AudioLengthThresh ){
                        SendData();
                        console.log('audio send');
                 }

              audioData = [];
             console.log('reset count');
              silentCount = 0;
         } 
       }


    console.log("ok");
    return "ok"
  }


  const readWaveData = view => {
    const riffHeader = readString(view, 0, 4) // RIFFヘッダ
    const fileSize = view.getUint32(4, true) // これ以降のファイルサイズ (ファイルサイズ - 8byte)
    const waveHeader = readString(view, 8, 4) // WAVEヘッダ

    const fmt = readString(view, 12, 4) // fmtチャンク
    const fmtChunkSize = view.getUint32(16, true) // fmtチャンクのバイト数(デフォルトは16)
    console.log("fmtChunkSize:%d",fmtChunkSize);
    const fmtID = view.getUint16(20, true) // フォーマットID(非圧縮PCMなら1)
    console.log("fmtID:%d",fmtID);
    const channelNum = view.getUint16(22, true) // チャンネル数
    console.log("channleNum:%d",channelNum);
    audio_sample_rate = view.getUint32(24, true) // サンプリングレート
    const dataSpeed = view.getUint32(28, true) // バイト/秒 1秒間の録音に必要なバイト数(サンプリングレート*チャンネル数*ビットレート/8)
    const blockSize = view.getUint16(32, true) // ブロック境界、(ステレオ16bitなら16bit*2=4byte)
    console.log("ブロック境界:%d",blockSize);
    const bitRate = view.getUint16(34, true) // ビットレート
    console.log("ビットレート:%d",bitRate);
    let exOffset = 0 //拡張パラメータ分のオフセット
    if (fmtChunkSize > 16) {
      const extendedSize = fmtChunkSize - 16 // 拡張パラメータのサイズ
      exOffset = extendedSize
    }
    let ChunkID;
    let ChunkSize = 0;
    let loopOffset = 0;
    while (ChunkID != "data"){
       ChunkID = readString(view, 36 + exOffset + loopOffset, 4) // チャンクID
       ChunkSize = view.getUint32(40 + exOffset + loopOffset, true) // チャンクバイト数
       loopOffset += 8 + ChunkSize
        }
    const samples = read16bitPCM(view, 36 + exOffset + loopOffset - ChunkSize, ChunkSize,bitRate, channelNum) // 波形データを受け取る
    return samples
  }

function displayProc(){

    var all_texts_list = document.getElementsByClassName("SpeechText");
    var all_speech_type = document.getElementsByClassName("SpeechType");
    var all_texts = "";
    var all_tasks = "";
    var tmpText 
    for(var i=0;i<all_texts_list.length;i++){
       //スペース削除
       tmpText = all_texts_list[i].value.replace(/\s+/g, "");
       if (tmpText != ""){    
        all_texts += tmpText + "\n";
        if (all_speech_type[i].value == "タスク"){
                all_tasks += "・"+ tmpText + "\n";
         }
        }
    }
    var js_data = {'text':all_texts,'tasks':all_tasks}
    var options = { 
                method : 'POST',
                headers : {"Content-Type" : "application/json"},
                body : JSON.stringify(js_data)}
  
    var win = window.open("", "child", "width=1200, height=900");
    win.document.body.innerHTML = "loading...";
    console.log(all_speech_type);

    fetch("/summary",options).then(response => response.json()).then(function(response){
      
     win.location.href =  response["url"];
  //   console.log(response["scores"])
   //  console.log(response["src"])
   //  let body = document.body
    // let input = document.createElement("input");
    // input.setAttribute("type", "text");
    // input.setAttribute("value", sumtext);
    // input.setAttribute("id", "SummaryText");
    // body.appendChild(input);
   });

}

  // Define the storeVideo() function
function storeSpeech(Text,Type,AudioData,audio_sample_rate) {
  // Open transaction, get object store; make it a readwrite so we can write to the IDB
  let objectStore = db.transaction(['speechs_os'], 'readwrite').objectStore('speechs_os');
  // Create a record to add to the IDB
  let record = {
    text : Text,
    _type : Type,
    audioData :AudioData,
    fs : audio_sample_rate
  }

  // Add the record to the IDB using add()
  let request = objectStore.add(record);

  request.onsuccess = function() {
    console.log('Record addition attempt finished');
  }

  request.onerror = function() {
    console.log(request.error);
  }

};

