// for audio
var audio_sample_rate = null;
var scriptProcessor = null;
var audioContext = null;
// audio data
var audioData = [];
var bufferSize = 1024;
var pushFrag = 0;
var recThresh = 0.1;
var silentCount= 0;
const audioLenTh = 22;
const silentTh = 20;
const MFCCTh = 2;
  // Create an instance of a db object for us to store our database in
let db;
 

async function SendData(){
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
     
     samples = mergeBuffers(audioData);
     let url = exportWAV(audioData);
     data = {'fs':audio_sample_rate,'samples':samples}
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


var onAudioProcess = function (e) {
  var input = e.inputBuffer.getChannelData(0);
  var bufferData = new Float32Array(1024);
  for (var i = 0; i < bufferSize; i++){
        bufferData[i] = input[i];
       }
             
        audioData.push(bufferData);
        
        if ( Math.max(...bufferData) > recThresh){
      //        console.log('MAX');
              silentCount = 0; 
        } else {
       // console.log(typeof silentCount);
        silentCount += 1;
        
         if ( silentCount > 50){
                if (audioData.length > 51 ){
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

function availableData( arr ){
  var b = false;
  for( var i = 0; i < arr.length && !b; i ++ ){
    b = ( arr[i] != 0 );
  }
}

  // Define the storeVideo() function
function storeSpeech(WavFile,name) {
  // Open transaction, get object store; make it a readwrite so we can write to the IDB
  let objectStore = db.transaction(['speechs_os'], 'readwrite').objectStore('speechs_os');
  // Create a record to add to the IDB
  let record = {
    wav : WavFile,
    name : name
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

  // Define the displayVideo() function
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
    var file = e.target.files[0];
    
    if(typeof e.target.files[0] !== 'undefined') {
        // ファイルが正常に受け取れた際の処理

        FileUpload(file);
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

    const view = new DataView(fileReader.result);
    const samples = readWaveData(view) // DataViewから波形データを読み込む
    console.log(samples);
    
    slen = samples.length;
    index_max = Math.ceil(slen/1024);
    audioData = [];
    var audioChunk;
    for( let i = 0; i < index_max ; i ++){
          if( i == index_max-1){
                audioChunk = samples.slice(i*1024); 
          }else{
                audioChunk = samples.slice(i*1024,(i+1)*1024);
               }
        // console.log("Max of Cunk: %.4f", Math.max(...audioChunk));
        // console.log("silentCount: %d", silentCount);
        // console.log("aoudioLen: %d", audioData.length);
         audioData.push(audioChunk);
         if ( Math.max(...audioChunk) > recThresh){
              silentCount = 0; 
        } else {
              silentCount += 1;
        
              if ( silentCount > silentTh){
                if (audioData.length > audioLenTh ){
                        SendData(audioData);
                        console.log('audio send');
                 }
              
              audioData = [];
              console.log('reset count');
              silentCount = 0; 
         }      
       }
    }

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
  const read16bitPCM = (view, offset, length, bitRate) => {
    let input = []
    let output = []
    for (let i = 0; i < length / 2; i++) {
      input[i] = view.getInt16(offset + i * 2, true)
      output[i] = parseFloat(input[i]) / parseFloat(2**(bitRate-1))
      if (output[i] > 1.0) output[i] = 1.0
      else if (output[i] < -1.0) output[i] = -1.0
    }
    return output
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
    const data = readString(view, 36 + exOffset, 4) // dataチャンク
    const dataChunkSize = view.getUint32(40 + exOffset, true) // 波形データのバイト数
    const samples = read16bitPCM(view, 44 + exOffset, dataChunkSize + exOffset,bitRate) // 波形データを受け取る

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
  
    var win = window.open("", "child", "width=400, height=300");
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
