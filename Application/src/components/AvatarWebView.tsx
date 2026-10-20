import React, { useRef, useCallback, forwardRef, useImperativeHandle, useEffect, useState } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import type { AvatarMessage, WebViewOutgoingMessage, AvatarName } from '../types';

export function getAvatarHtmlContent(initialAvatar: AvatarName = 'luna'): string {
  return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>SignVision Avatar</title>
    <link rel="stylesheet" href="https://vhg.cmp.uea.ac.uk/tech/jas/vhg2026/cwa/cwasa.css">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { width: 100%; height: 100%; overflow: hidden; background: transparent; }
        .main { display: flex; flex-direction: column; width: 100%; height: 100%; position: relative; }
        .avatar-wrap { flex: 1; display: flex; align-items: center; justify-content: center; }
        .CWASAAvatar { width: 100% !important; height: 100% !important; max-width: 450px; max-height: 550px; }
        .hidden { display: none !important; }
        .status { position: absolute; bottom: 15px; left: 50%; transform: translateX(-50%);
            background: rgba(0,0,0,0.75); color: #fff; padding: 8px 20px; border-radius: 20px; font-size: 13px; z-index: 10; pointer-events: none; }
        .status.fade { opacity: 0; transition: opacity 0.3s; }
        .spinner { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
            width: 50px; height: 50px; border: 4px solid rgba(255,255,255,0.2);
            border-top-color: #4CAF50; border-radius: 50%; animation: spin 1s linear infinite; z-index: 10; pointer-events: none; }
        @keyframes spin { to { transform: translate(-50%,-50%) rotate(360deg); } }
        .word-badge { position: absolute; top: 10px; left: 10px; background: #4CAF50; color: #fff;
            padding: 6px 14px; border-radius: 15px; font-weight: 600; font-size: 13px; z-index: 10; }
        .ctrl { position: absolute; top: 10px; right: 10px; z-index: 10; }
        .ctrl button { background: rgba(255,255,255,0.15); border: none; color: #fff;
            padding: 8px 14px; border-radius: 8px; cursor: pointer; font-size: 12px; }
        .ctrl button:hover { background: rgba(255,255,255,0.25); }
    </style>
</head>
<body>
    <div class="main">
        <div class="word-badge hidden" id="wordBadge"></div>
        <div class="ctrl"><button onclick="doStop()">Stop</button></div>
        <div class="avatar-wrap">
            <div class="CWASAAvatar av0" id="avatarDiv"></div>
        </div>
        <div class="spinner" id="spinner"></div>
        <div class="status" id="status">Initializing...</div>
    </div>
    
    <div style="display:none">
        <input type="text" class="txtSiGMLURL av0" id="inpURL">
        <button class="bttnPlaySiGMLURL av0" id="btnPlay">Play</button>
        <button class="bttnStop av0" id="btnStop">Stop</button>
        <input type="text" class="statusExtra av0" id="inpStatus">
        <select class="menuAv av0" id="selAv">
            <option value="luna">luna</option>
            <option value="marc">marc</option>
            <option value="anna">anna</option>
            <option value="francoise">francoise</option>
            <option value="siggi">siggi</option>
        </select>
    </div>
    <div class="SToCA"></div>

    <script>
        var INITIAL_AVATAR = '${initialAvatar}';
        window.CWA_CFG_DATA = {
            jasBase: 'https://vhg.cmp.uea.ac.uk/tech/jas/vhg2026/',
            jasVersionTag: 'vhg2026',
            sigmlBase: 'sigml',
            avJARBase: 'avatars',
            avJSONBase: 'avjson',
            useAvatarJARs: true,
            animgenFPS: 30,
            avs: ['luna', 'marc', 'francoise', 'anna', 'siggi'],
            avsfull: ['luna', 'marc', 'francoise', 'anna', 'siggi'],
            avSettings: [{
                width: 384, 
                height: 320, 
                avList: 'avsfull', 
                initAv: INITIAL_AVATAR,
                ambIdle: false,
                initCamera: [0, 0.20, 3.20, 5, 18, 30, -1, -1],
                allowFrameSteps: true, 
                allowSiGMLText: true
            }]
        };
        
        window.CWA_CLIENT_CFG_DATA = {
            avSettings: [{
                width: 384,
                height: 320,
                avList: 'avsfull',
                initAv: INITIAL_AVATAR,
                ambIdle: false,
                allowFrameSteps: true,
                allowSiGMLText: true
            }]
        };
    </script>
    <script src="https://vhg.cmp.uea.ac.uk/tech/jas/vhg2026/cwa/allcsa.js"></script>
    <script>
        var ready = false;
        var word = '';
        var initDone = false;
        var statusWatchStarted = false;
        var currentAv = INITIAL_AVATAR;
        var isSwitching = false;
        var sequenceWords = [];
        var sequenceBaseIndex = 0;
        var isSequence = false;
        var spinner, statusEl, wordBadge, inpURL, btnPlay, btnStop, inpStatus;

        function initElements() {
            spinner = document.getElementById('spinner');
            statusEl = document.getElementById('status');
            wordBadge = document.getElementById('wordBadge');
            inpURL = document.getElementById('inpURL');
            btnPlay = document.getElementById('btnPlay');
            btnStop = document.getElementById('btnStop');
            inpStatus = document.getElementById('inpStatus');
            var sel = document.getElementById('selAv');
            if (sel) sel.value = currentAv;
        }

        function msg(m) {
            var t = JSON.stringify(m);
            if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(t);
            } else {
                window.parent.postMessage(t, '*');
            }
        }

        function showStatus(t) { if(statusEl) { statusEl.textContent = t; statusEl.classList.remove('fade'); } }
        function hideStatus() { if(statusEl) statusEl.classList.add('fade'); }
        function showSpinner() { if(spinner) spinner.classList.remove('hidden'); }
        function hideSpinner() { if(spinner) spinner.classList.add('hidden'); }
        function showWord(w) { if(wordBadge) { wordBadge.textContent = w.toUpperCase(); wordBadge.classList.remove('hidden'); } }
        function hideWord() { if(wordBadge) wordBadge.classList.add('hidden'); }

        function registerHooks() {
            if (typeof CWASA !== 'undefined' && CWASA.addHook) {
                CWASA.addHook('avatarloading', function(evt) {
                    var av = (evt && evt.msg) ? evt.msg : currentAv;
                    isSwitching = true;
                    showStatus('Loading ' + av + '...');
                    showSpinner();
                    msg({ type: 'status', status: 'Loading ' + av });
                });
                CWASA.addHook('avatarloaded', function(evt) {
                    var av = (evt && evt.msg) ? evt.msg : currentAv;
                    currentAv = av;
                    isSwitching = false;
                    ready = true;
                    hideSpinner();
                    showStatus('Ready');
                    setTimeout(hideStatus, 1500);
                    msg({ type: 'avatarChanged', avatar: av });
                    msg({ type: 'ready' });
                });
                CWASA.addHook('avatarsign', function(evt) {
                    if (!evt) return;
                    var sIdx = typeof evt.s === 'number' ? evt.s : 0;
                    var signWord = (evt.g && evt.g.replace(/_\d+$/, '')) || (sequenceWords && sequenceWords[sIdx]) || word;
                    word = signWord;
                    showWord(signWord);
                    showStatus('Signing: ' + signWord);
                    msg({ type: 'playing', word: signWord, signIndex: sequenceBaseIndex + sIdx });
                });
                CWASA.addHook('animactive', function() {
                    isPlaying = true;
                    var currentSignWord = (sequenceWords && sequenceWords[0]) || word;
                    if (currentSignWord) {
                        showWord(currentSignWord);
                        showStatus('Signing: ' + currentSignWord);
                    }
                    msg({ type: 'playing', word: currentSignWord, signIndex: sequenceBaseIndex });
                });
                CWASA.addHook('animidle', function() {
                    if (isPlaying) {
                        isPlaying = false;
                        showStatus('Done');
                        msg({ type: 'finished', word: word });
                        setTimeout(function() { hideStatus(); hideWord(); }, 800);
                    }
                });
            }
        }

        function initCWASA() {
            if (initDone) return;
            initDone = true;
            
            initElements();
            showStatus('Loading avatar...');
            
            try {
                registerHooks();
                if (typeof CWASA !== 'undefined' && CWASA.init) {
                    CWASA.init(window.CWA_CFG_DATA, window.CWA_CLIENT_CFG_DATA);
                }
                
                setTimeout(function() {
                    ready = true;
                    isSwitching = false;
                    hideSpinner();
                    showStatus('Ready');
                    msg({ type: 'ready' });
                    msg({ type: 'avatarChanged', avatar: currentAv });
                    setTimeout(hideStatus, 2000);
                    if (!statusWatchStarted) {
                        statusWatchStarted = true;
                        watchStatus();
                    }
                }, 3500);
            } catch (e) {
                console.error('Init error:', e);
                showStatus('Init failed');
                msg({ type: 'error', message: 'Init failed' });
            }
        }

        var lastStatus = '';
        var isPlaying = false;

        function watchStatus() {
            setInterval(function() {
                if (!inpStatus) return;
                var s = inpStatus.value || '';
                if (s === lastStatus) return;
                
                console.log('CWASA Status:', JSON.stringify(s));
                msg({ type: 'status', status: s });
                lastStatus = s;
                
                var sLower = s.toLowerCase();
                
                if (sLower.indexOf('complete') >= 0 || sLower.indexOf('done') >= 0 || sLower.indexOf('finished') >= 0) {
                    if (isPlaying) {
                        isPlaying = false;
                        showStatus('Done'); 
                        msg({ type: 'finished', word: word });
                        setTimeout(function() { hideStatus(); hideWord(); }, 1000);
                    }
                } else if (sLower.indexOf('playing') >= 0 && sLower.indexOf('complete') < 0) { 
                    isPlaying = true;
                    showStatus('Playing: ' + word); 
                    msg({ type: 'playing', word: word, signIndex: sequenceBaseIndex }); 
                }
            }, 200);
        }

        function play(url, w) {
            if (isSwitching) {
                console.log('Switch in progress, queuing play');
                setTimeout(function() { play(url, w); }, 800);
                return;
            }
            if (!ready) { 
                console.log('Avatar not ready');
                msg({ type: 'error', message: 'Not ready' }); 
                return; 
            }
            if (!inpURL || !btnPlay) {
                initElements();
            }
            isSequence = false;
            sequenceWords = [w || ''];
            sequenceBaseIndex = 0;
            console.log('Playing:', url, w);
            word = w || '';
            lastStatus = '';
            isPlaying = false;
            showWord(word);
            showSpinner();
            showStatus('Loading...');
            inpURL.value = url;
            inpURL.dispatchEvent(new Event('change', { bubbles: true }));
            setTimeout(function() { 
                btnPlay.click(); 
                hideSpinner(); 
            }, 200);
        }

        function extractSignBlocks(xml, glossOverride) {
            if (!xml) return [];
            try {
                var dp = new DOMParser();
                var doc = dp.parseFromString(xml, 'text/xml');
                var signs = doc.querySelectorAll('hns_sign, hamgestural_sign');
                if (!signs || signs.length === 0) return [];
                var s = new XMLSerializer();
                var result = [];
                for (var i = 0; i < signs.length; i++) {
                    var el = signs[i];
                    if (glossOverride) {
                        var gVal = signs.length === 1 ? glossOverride : (glossOverride + '_' + (i + 1));
                        el.setAttribute('gloss', gVal);
                    }
                    result.push(s.serializeToString(el));
                }
                return result;
            } catch (e) {
                console.error('extractSignBlocks error:', e);
                return [];
            }
        }

        function combineSiGMLTexts(texts, words) {
            var blocks = [];
            for (var i = 0; i < texts.length; i++) {
                var b = extractSignBlocks(texts[i], words ? words[i] : null);
                for (var j = 0; j < b.length; j++) blocks.push(b[j]);
            }
            if (blocks.length === 0) return null;
            return '<sigml>' + blocks.join('') + '</sigml>';
        }

        function playSequence(sigmlText, words, baseIndex) {
            if (isSwitching) {
                console.log('Switch in progress, queuing playSequence');
                setTimeout(function() { playSequence(sigmlText, words, baseIndex); }, 800);
                return;
            }
            if (!ready) {
                console.log('Avatar not ready');
                msg({ type: 'error', message: 'Not ready' });
                return;
            }
            sequenceWords = words || [];
            sequenceBaseIndex = typeof baseIndex === 'number' ? baseIndex : 0;
            isSequence = true;
            word = sequenceWords[0] || '';
            lastStatus = '';
            isPlaying = true;
            if (word) showWord(word);
            showStatus('Signing: ' + word);

            try {
                if (typeof CWASA !== 'undefined' && CWASA.playSiGMLText) {
                    CWASA.playSiGMLText(sigmlText, 0);
                } else if (typeof CWASA !== 'undefined' && CWASA.playSiGML) {
                    CWASA.playSiGML(sigmlText);
                } else {
                    console.error('CWASA.playSiGMLText not available');
                    msg({ type: 'error', message: 'Engine does not support continuous SiGML' });
                }
            } catch (err) {
                console.error('playSequence error:', err);
                msg({ type: 'error', message: 'Failed to start continuous sequence' });
            }
        }

        function playSequenceUrls(urls, words, baseIndex) {
            if (!urls || urls.length === 0) return;
            showSpinner();
            showStatus('Loading sentence...');
            var fetchPromises = urls.map(function(u) {
                if (typeof Data !== 'undefined' && Data.fetchText) {
                    return Data.fetchText(u);
                }
                return fetch(u).then(function(r) { return r.text(); });
            });
            Promise.all(fetchPromises).then(function(texts) {
                hideSpinner();
                var combined = combineSiGMLTexts(texts, words);
                if (combined) {
                    playSequence(combined, words, baseIndex);
                } else {
                    msg({ type: 'error', message: 'Could not compile SiGML sequence' });
                }
            }).catch(function(err) {
                hideSpinner();
                console.error('playSequenceUrls error:', err);
                msg({ type: 'error', message: 'Failed to fetch SiGML assets' });
            });
        }

        function doPause() {
            if (typeof CWASA !== 'undefined') {
                var avP = (typeof avPanels !== 'undefined' && avPanels[0]) || null;
                if (avP && avP.suspendPlay) {
                    avP.suspendPlay();
                    showStatus('Paused');
                    msg({ type: 'status', status: 'paused' });
                }
            }
        }

        function doResume() {
            if (typeof CWASA !== 'undefined') {
                var avP = (typeof avPanels !== 'undefined' && avPanels[0]) || null;
                if (avP && avP.resumePlay) {
                    avP.resumePlay();
                    showStatus('Signing: ' + word);
                    msg({ type: 'status', status: 'playing' });
                }
            }
        }

        function doStop() {
            isPlaying = false;
            isSequence = false;
            sequenceWords = [];
            if (typeof CWASA !== 'undefined' && CWASA.stopSiGML) {
                CWASA.stopSiGML(0);
            }
            if (btnStop) btnStop.click();
            hideWord();
            showStatus('Stopped');
            msg({ type: 'stopped' });
            setTimeout(hideStatus, 1500);
        }

        var SUPPORTED_AVATARS = ['luna', 'marc', 'anna', 'francoise', 'siggi'];

        function changeAvatar(avName) {
            if (!avName || !SUPPORTED_AVATARS.includes(avName)) return;
            if (avName === currentAv && !isSwitching) return;

            if (isPlaying) {
                doStop();
            }

            var sel = document.getElementById('selAv') || document.querySelector('select.menuAv');
            if (sel) {
                isSwitching = true;
                currentAv = avName;
                showStatus('Loading ' + avName + '...');
                showSpinner();

                // Ensure target option exists in select element
                var opt = sel.querySelector('option[value="' + avName + '"]');
                if (!opt) {
                    opt = document.createElement('option');
                    opt.value = avName;
                    opt.textContent = avName;
                    sel.appendChild(opt);
                }

                sel.value = avName;

                // Safely trigger CWASA switchAvatar binding
                if (typeof sel.onchange === 'function') {
                    sel.onchange();
                } else {
                    sel.dispatchEvent(new Event('change', { bubbles: true }));
                }

                // Safety timeout fallback if hook does not trigger
                setTimeout(function() {
                    if (isSwitching) {
                        isSwitching = false;
                        hideSpinner();
                        showStatus('Ready');
                        setTimeout(hideStatus, 1500);
                        msg({ type: 'avatarChanged', avatar: avName });
                    }
                }, 3500);
            }
        }

        window.addEventListener('message', function(e) {
            try {
                var d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
                if (d.type === 'play') play(d.url, d.word);
                else if (d.type === 'playSequence') playSequence(d.sigmlText, d.words, d.initialIndex);
                else if (d.type === 'playSequenceUrls') playSequenceUrls(d.urls, d.words, d.initialIndex);
                else if (d.type === 'pause') doPause();
                else if (d.type === 'resume') doResume();
                else if (d.type === 'stop') doStop();
                else if (d.type === 'changeAvatar') changeAvatar(d.avatar);
                else if (d.type === 'ping') msg({ type: 'pong', initialized: ready, avatar: currentAv });
            } catch (err) {}
        });

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initCWASA);
        } else {
            initCWASA();
        }
    </script>
</body>
</html>`;
}

export const AVATAR_HTML_CONTENT = getAvatarHtmlContent('luna');

const blobUrlCache: Record<string, string> = {};

function getBlobUrl(avatar: AvatarName = 'luna'): string {
  if (!blobUrlCache[avatar]) {
    const html = getAvatarHtmlContent(avatar);
    const blob = new Blob([html], { type: 'text/html' });
    blobUrlCache[avatar] = URL.createObjectURL(blob);
  }
  return blobUrlCache[avatar];
}

export interface AvatarWebViewRef {
  play: (url: string, word: string) => void;
  playSequence?: (sigmlText: string, words: string[], initialIndex?: number) => void;
  playSequenceUrls?: (urls: string[], words: string[], initialIndex?: number) => void;
  pause?: () => void;
  resume?: () => void;
  stop: () => void;
  ping: () => void;
  setAvatar?: (avatar: AvatarName) => void;
  setSpeed?: (speed: number) => void;
  resetCamera?: () => void;
}

interface AvatarWebViewProps {
  avatar?: AvatarName;
  onReady?: () => void;
  onPlaying?: (word: string, signIndex?: number) => void;
  onFinished?: (word: string) => void;
  onError?: (message: string) => void;
  onStatusChange?: (status: string, gloss?: string) => void;
  onAvatarChange?: (avatar: string) => void;
}

const AvatarWebView = forwardRef<AvatarWebViewRef, AvatarWebViewProps>(
  ({ avatar = 'luna', onReady, onPlaying, onFinished, onError, onStatusChange, onAvatarChange }, ref) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const webViewRef = useRef<any>(null);
    const [blobUrl] = useState(() => Platform.OS === 'web' ? getBlobUrl(avatar) : '');
    const activeAvatarRef = useRef<AvatarName>(avatar);

    const sendMessage = useCallback((message: WebViewOutgoingMessage) => {
      if (Platform.OS === 'web') {
        iframeRef.current?.contentWindow?.postMessage(JSON.stringify(message), '*');
      } else if (webViewRef.current) {
        webViewRef.current.postMessage(JSON.stringify(message));
      }
    }, []);

    useImperativeHandle(ref, () => ({
      play: (url: string, word: string) => {
        sendMessage({ type: 'play', url, word });
      },
      playSequence: (sigmlText: string, words: string[], initialIndex = 0) => {
        sendMessage({ type: 'playSequence', sigmlText, words, initialIndex });
      },
      playSequenceUrls: (urls: string[], words: string[], initialIndex = 0) => {
        sendMessage({ type: 'playSequenceUrls', urls, words, initialIndex });
      },
      pause: () => {
        sendMessage({ type: 'pause' });
      },
      resume: () => {
        sendMessage({ type: 'resume' });
      },
      stop: () => {
        sendMessage({ type: 'stop' });
      },
      ping: () => {
        sendMessage({ type: 'ping' });
      },
      setAvatar: (newAvatar: AvatarName) => {
        if (newAvatar !== activeAvatarRef.current) {
          activeAvatarRef.current = newAvatar;
          sendMessage({ type: 'changeAvatar', avatar: newAvatar });
        }
      },
      setSpeed: (speed: number) => {
        sendMessage({ type: 'speed', speed });
      },
      resetCamera: () => {
        sendMessage({ type: 'resetCamera' });
      },
    }));

    useEffect(() => {
      if (avatar && avatar !== activeAvatarRef.current) {
        activeAvatarRef.current = avatar;
        sendMessage({ type: 'changeAvatar', avatar });
      }
    }, [avatar, sendMessage]);

    const handleMessage = useCallback((data: AvatarMessage) => {
      switch (data.type) {
        case 'ready':
          onReady?.();
          break;
        case 'avatarChanged':
          if (data.avatar) {
            activeAvatarRef.current = data.avatar as AvatarName;
            onAvatarChange?.(data.avatar);
          }
          break;
        case 'playing':
          if (data.word) onPlaying?.(data.word, data.signIndex);
          break;
        case 'finished':
          if (data.word) onFinished?.(data.word);
          break;
        case 'error':
          onError?.(data.message || 'Unknown error');
          break;
        case 'status':
          onStatusChange?.(data.status || '', data.gloss);
          break;
      }
    }, [onReady, onAvatarChange, onPlaying, onFinished, onError, onStatusChange]);

    useEffect(() => {
      if (Platform.OS === 'web') {
        const listener = (event: MessageEvent) => {
          try {
            const data: AvatarMessage = typeof event.data === 'string'
              ? JSON.parse(event.data)
              : event.data;
            handleMessage(data);
          } catch {
          }
        };
        window.addEventListener('message', listener);
        return () => window.removeEventListener('message', listener);
      }
    }, [handleMessage]);

    if (Platform.OS === 'web') {
      return (
        <View style={styles.container}>
          <iframe
            ref={iframeRef}
            src={blobUrl}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              borderRadius: 16,
            }}
            allow="accelerometer; autoplay; encrypted-media; gyroscope"
          />
        </View>
      );
    }

    const WebView = require('react-native-webview').WebView;

    const handleWebViewMessage = (event: any) => {
      try {
        const data: AvatarMessage = JSON.parse(event.nativeEvent.data);
        handleMessage(data);
      } catch (error) {
        console.error('Error parsing WebView message:', error);
      }
    };

    const injectedJavaScript = `
      (function() {
        if (!window.ReactNativeWebView) {
          window.ReactNativeWebView = {
            postMessage: function(data) { window.postMessage(data, '*'); }
          };
        }
        document.addEventListener('message', function(e) {
          window.dispatchEvent(new MessageEvent('message', { data: e.data }));
        });
        true;
      })();
    `;

    return (
      <View style={styles.container}>
        <WebView
          ref={webViewRef}
          source={{ html: getAvatarHtmlContent(avatar) }}
          style={styles.webview}
          onMessage={handleWebViewMessage}
          injectedJavaScript={injectedJavaScript}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          originWhitelist={['*']}
          {...(Platform.OS === 'android' && {
            androidHardwareAccelerationDisabled: false,
            androidLayerType: 'hardware',
          })}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          scalesPageToFit={true}
          mixedContentMode="compatibility"
          allowFileAccess={true}
          allowUniversalAccessFromFileURLs={true}
          onError={(syntheticEvent: any) => {
            const { nativeEvent } = syntheticEvent;
            console.error('WebView error:', nativeEvent);
            onError?.('WebView error: ' + nativeEvent.description);
          }}
        />
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: 16,
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

export default AvatarWebView;
