import numpy as np
class FeatureExtractor():
    def __init__(self, sample_frequency=16000, frame_length=25,frame_shift=10,num_mel_bins=23, 
                 num_ceps=13, lifter_coef=13, low_frequency=20,high_frequency=8000, dither=1.0):
        self.sample_freq=sample_frequency
        #窓幅をサンプル数へ変換
        self.frame_size = int(sample_frequency*frame_length*0.01)
        #フレームシフトをサンプル数へ変換
        self.frame_shift=int(sample_frequency*frame_shift*0.01)
        #メルフィルタバンクの個数
        self.num_mel_bins = num_mel_bins
        #MFCCの次元数
        self.num_ceps = num_ceps
        #リフタリングのパラメータ
        self.lifter_coef = lifter_coef
        #低域周波数除去のカットオフ周波数[Hz]
        self.low_frequency = low_frequency
        #広域周波数除去のカットオフ周波数[Hz]
        self.high_frequency = high_frequency 
        #ディザリング係数
        self.dither_coef = dither
        
        #FFTのポイント数 = 窓幅以上の2のべき乗
        self.fft_size = 1
        while self.fft_size < self.frame_size:
            self.fft_size *= 2
        #メルフィルタバンクの作成
        self.mel_filter_bank = self.MakeMelFilterBank()
        
    def Herz2Mel(self,herz):
        #周波数からメルに変換する
        return(1127.0 * np.log(1.0 + herz / 700))
    def MakeMelFilterBank(self):
        #メル軸での最大周波数
        mel_high_freq = self.Herz2Mel(self.high_frequency)
        #メル軸での最小周波数
        mel_low_freq = self.Herz2Mel(self.low_frequency)
        #最小から最大周波数までメル軸上で等間隔な周波数を得る
        mel_points = np.linspace(mel_low_freq,mel_high_freq,self.num_mel_bins+2)
        #パワースペクトルの次元数
        dim_spectrum = int(self.fft_size / 2)+1
        #メルフィルタバンク
        mel_filter_bank = np.zeros((self.num_mel_bins,dim_spectrum))
        
        for m in range(self.num_mel_bins):
            left_mel = mel_points[m]
            center_mel = mel_points[m+1]
            right_mel = mel_points[m+2]
            # パワースペクトルの各ビンに対応する重みを計算する
            for n in range(dim_spectrum):
                #各ビンに対応するヘルツ軸周波数を計算
                freq = 1.0*n*self.sample_freq/2 / dim_spectrum
                #メル周波数に変換
                mel = self.Herz2Mel(freq)
                #その便が三角フィルタの中に入っていれば重みを計算
                if mel > left_mel and mel < right_mel:
                    if mel <= center_mel:
                        weight = (mel - left_mel / center_mel - left_mel)
                    else:
                        weight = (right_mel - mel)/(right_mel-center_mel)
                    mel_filter_bank[m][n] = weight
        return mel_filter_bank
    
    def ExtractWindow(self,waveform, start_index, num_samples):
        #waveformから1フレーム分のはけいを抽出する
        window = waveform[start_index:start_index + self.frame_size].copy()
        
        #ディザリングを行う
        
        if self.dither_coef > 0:
            window = window + np.random.rand(self.frame_size)*(2*self.dither_coef)-self.dither_coef
            
        #直流成分をカットする
        window - window - np.mean(window)
        
        #以降の処理を行う前にパワーを求める
        power = np.sum(window**2)
        #対数計算時に-infが出ないようにフロアリング処理を行う
        if power < 1e-10:
            ower = 1e-10
        #対数を取る
        log_power = np.log(power)
        
        #プリエンファシス(高域強調)
        window = np.convolve(window,np.array([1.0,-0.97]),mode = 'same')
        #numpyの畳み込みでは0番目の要素が処理されない
        window[0] -= 0.97*window[0]
        
        #ハミング窓をかける
        window *= np.hamming(self.frame_size)
        
        return window, log_power
    def ComputeFBANK(self, waveform):
        #対数メルフィルタバンクを計算
        #波形データの総サンプル数
        num_samples = np.size(waveform)
        #特徴量の総フレーム数を計算する
        num_frames = (num_samples - self.frame_size)// self.frame_shift +1
        #メルフィルタバンク特徴
        fbank_features = np.zeros((num_frames, self.num_mel_bins))
        #対数パワー
        log_power = np.zeros(num_frames)

        #1フレームずつ特徴量を計算
        for frame in range(num_frames):
            start_index = frame * self.frame_shift
            
            #1フレーム分の波形を抽出し前処理
            window, log_pow = self.ExtractWindow(waveform,start_index,num_samples)
            
            #パワースペクトル
            spectrum = np.fft.fft(window,n=self.fft_size)
            spectrum = spectrum[:int(self.fft_size/2)+1]
            spectrum = np.abs(spectrum) ** 2
            
            #メルフィルタバンクを畳み込む
            fbank = np.dot(spectrum, self.mel_filter_bank.T)
            
            #対数計算時に-infが出力されないように, フロアリング
            fbank[fbank<0.1] = 0.1
            
            #対数を取ってfbank_featuresに加える
            #fbank_featuresに加える
            fbank_features[frame] = np.log(fbank)
            #対数パワーの値をlog_powerに加える
            log_power[frame] = log_pow
            
        return fbank_features, log_power
    
class FeatureExtractor2(FeatureExtractor):
    
    def MakeDCTMatrix(self):
        N = self.num_mel_bins
        #DCTの基底行列
        dct_matrix = np.zeros((self.num_ceps,self.num_mel_bins))
        for k in range(self.num_ceps):
            if k == 0:
                dct_matrix[k] = np.ones(self.num_mel_bins)*1.0/np.sqrt(N)
            else:
                dct_matrix[k] = np.sqrt(2/N)*np.cos(((2.0*np.arange(N)+1)*k*np.pi)/(2*N))
        return dct_matrix

    def MakeLifter(self):
        Q = self.lifter_coef
        I = np.arange(self.num_ceps)
        lifter = 1.0 + 0.5*Q*np.sin(np.pi*I/Q)
        return lifter

    def ComputeMFCC(self,waveform):
        fbank,log_power = self.ComputeFBANK(waveform)
        dct_matrix = self.MakeDCTMatrix()
        #DCTとの基底行列との内積により, DCTを実施する
        mfcc = np.dot(fbank, dct_matrix.T)
        lifter = self.MakeLifter()
        #リフタリング
        mfcc *= lifter
        
        #MFCCの０次元目を前処理をする前の波形の対数パワーに置き換える
        mfcc[:,0] = log_power
        
        return mfcc
