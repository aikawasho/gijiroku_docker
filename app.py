#-*- coding: utf-8-*-
import sys
import os
sys.path.append('/usr/local/lib64/python3.6/site-packages/')
sys.path.append('/usr/local/lib/python3.6/site-packages/')
sys.path.append('/var/www/app')
import io,sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from flask import Flask,render_template, send_from_directory,request,jsonify,redirect, url_for
import json
import array
import struct
import numpy as np
import scipy.io.wavfile as siw
import time
from BertSum.server_BertSum.bert_summary import Bertsum_pred
from tools.speech_t import speech_text
import ssl
from werkzeug.utils import secure_filename
from tools.MFCC.MFCC import FeatureExtractor2
import wave
import scipy

#会議の音声を読み込み
input_path = '/var/www/app/tools/MFCC/162419449465.wav' 
waveFile = wave.open(input_path, 'r')
data = waveFile.readframes(-1)
nchanneles = waveFile.getnchannels()
samplewidth = waveFile.getsampwidth()
framerate = waveFile.getframerate()
if samplewidth == 2:
    compare_array = np.frombuffer(data,dtype='int16')
else:
    compare_array = np.frombuffer(data,dtype='int24')
waveFile.close()
#MFCCパラメータ
num_mel_bins = 23
num_ceps = 13
sample_frequency = framerate
frame_length = 25
frame_shift = 10
low_frequency = 20
high_frequency = sample_frequency / 2
dither = 1.0
feat_extractor = FeatureExtractor2(sample_frequency=sample_frequency, frame_length = frame_length,
                                  frame_shift = frame_shift,num_mel_bins = num_mel_bins,num_ceps = num_ceps,
                                  low_frequency=low_frequency,high_frequency=high_frequency,dither=dither)
mfcc_th = 3.0
#基準となる音声の特徴量
mfcc0 = feat_extractor.ComputeMFCC(compare_array[sample_frequency:sample_frequency*4])

#コサイン類似度もとめる
def cos_sim(v1, v2):
    return np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2))
app = Flask(__name__)

def raw2PCM(raw_floats):
        floats = array.array('f', raw_floats)
        samples = [int(sample * 32767)
                   for sample in floats]       
        results = np.array(samples, dtype = 'int16')
        #print(max(results))
        return results

#Flaskオブジェクトの生成
app = Flask(__name__)
#「/」へアクセスがあった場合に、"Hello World"の文字列を返す
@app.route('/',methods = ['POST','GET'])
def hello():
    if request.method == 'POST':
        result = request.get_json()
        samples = result['samples']
        fs = result['fs']
       # print('samples',type(samples))
        audioData =[]
        for jsn_val in samples.values():
                audioData.append(jsn_val);
        audioData = raw2PCM(audioData)
        #ケプストラム
        mfcc1 = feat_extractor.ComputeMFCC(audioData[:min(framerate*3,len(audioData))])
        score = 0
        for frame in range(min(8,len(mfcc1[:,0]))):	
            score += cos_sim(mfcc0[frame,:],mfcc1[frame,:])
            print("スコア:",score)
       
        wav_id = int(time.time())
        output_path =  "/var/www/app/wav/" + str(wav_id) + ".wav"
        siw.write(output_path, fs ,audioData)
        text,type_ = speech_text(output_path)
        print('テキスト化')
        print(text)
        return jsonify({"text": text,"type":type_, "file_name" : str(wav_id),"score":score} )
    return render_template('rec_test.html')

if __name__ == "__main__":
    app.run()


@app.route('/fileUp',methods=["GET","POST"])
def rec_data():
    print('ポストを受け取りました')
    file_ob = request.files['upfile']
    type_ = str(type(file_ob))
    filename = secure_filename(file_ob.filename)
    out_path = os.path.join("./wav", filename)
    file_ob.save(out_path)
    waveFile = wave.open(out_path, 'r')
    data = waveFile.readframes(-1)
    nchanneles = waveFile.getnchannels()
    samplewidth = waveFile.getsampwidth()
    framerate = waveFile.getframerate()
    if samplewidth == 2:
       audio_data= np.frombuffer(data,dtype='int16')
    else:
       audio_data = np.frombuffer(data,dtype='int24')
    waveFile.close()
    #ケプストラム
    mfcc1 = feat_extractor.ComputeMFCC(audio_data[:min(framerate*3,len(audio_data))])
    score = 0
    for frame in range(min(8,len(mfcc1[:,0]))):
              score += cos_sim(mfcc0[frame,:],mfcc1[frame,:])
              print("スコア:",score)

    text,type_ = speech_text(out_path)
    url =  url_for('uploaded_file',filename=filename)
    return jsonify({"text":text,"type":type_,"source":url,"score":score})
 
@app.route('/music/<path:filename>')
def download_file(filename):
    return send_from_directory('/Users/shotta_control/Documents/ginza/JS_test/music', filename)
@app.route('/favicon.ico')
def favicon():
    return send_from_directory('/home/ec2-user/summary_server/gijirou_web/image/',
                               'favicon.ico')

if __name__ == "__main__":
        app.run(debug=False, host='0.0.0.0',port = 9012)
