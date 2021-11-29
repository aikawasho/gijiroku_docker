import os
import time
import speech_recognition as sr
from .parse_5w1h import parse_5w1h

#os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = '/Users/shota/Downloads/My First Project-06971ca6a80e.json'

def speech_text(wav_path):

    fs = 16000

    r = sr.Recognizer()
    type_ = ''
    with sr.AudioFile(wav_path) as source:
        audio = r.record(source)
    try:
        text = r.recognize_google(audio, language='ja-JP')
        parse = parse_5w1h(0)
        parse.extract(text)
        if parse.display_type():
            type_ = parse.display_type()

    except sr.UnknownValueError:
        # 何を言っているのかわからなかった場合の処理
        print("例外発生", "could not understand audio")
        text =''
    except sr.RequestError as e:
        # レスポンスが返ってこなかった場合の処理
        print("例外発生", "Could not request results from Google Speech Recognition service; {0}".format(e))
        text = ''


    print(text)
   # print(type_)
    #text_dict['あ']="",sorted(wav_file)[i]

        
    return text,type_

if __name__ == "__main__":
    
    speech_text()
