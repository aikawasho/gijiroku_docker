// for audioaaaaa
var audio_sample_rate = null;
var scriptProcessor = null;
var audioContext = null;
// audio data
var audioData = [];
var bufferSize = 1024;
var pushFrag = 0;
var recThresh = 0.2;
var silentCount= 0;

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
    
    displaySpeech(response['text'],response['type'],url);
     
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
                if (audioData.length > 55 ){
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
    input.id  = "SpeechText"; 
    body.appendChild(input);
    body.appendChild(audio);
    audio.appendChild(source);
    let select = document.createElement('select');
    select.setAttribute("name","type_label");
    select.size = "1";
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
    body.appendChild(document.createElement("p")); 
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

          var dataview = encodeWAV(mergeBuffers(audioData), audioContext.sampleRate);
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

        FileUpload(file)
    } else {
        // ファイルが受け取れなかった際の処理
        console.log("ファイル受け取れない");
    }
}, false);

function FileUpload(Files){
     let data = new FormData();
     data.append('upfile',Files[0],Files[0].name); 
     var options = {
                method : 'POST',
                body :data}
   
     fetch("/fileUp",options).then(response => response.json()).then(response => displaySpeech(response['text'],response["type"],response["source"]));
     
}
  function displaySpeech2(text) {
    // Create object URLs out of the blobs
    let body = document.body
    let input = document.createElement("input");
    input.setAttribute("type", "text");
    input.setAttribute("value", text);
    input.id  = "SpeechText"; 
    body.appendChild(input);
    body.appendChild(document.createElement("p")); 
  }

