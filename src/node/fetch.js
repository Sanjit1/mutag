/**
 * Read mp3 file as binary data.
 */
import {parsePRIV} from './parse';
import {getStr, filterStr, getImgIndex} from './utils';
import {gbk} from './gbk';

export default function fetchFile(file) {

  const readerPromise = new Promise((resolve, reject) => {
    parseFile(file, resolve);
  });

  return readerPromise;
}

function parseFile (data, resolve) {
  if (typeof data != 'object') {
    throw new Error('the path of file is not correct!');
  }
  var header = data.slice(0, 10);
  var size = header[9] & 0x7f
           | ((header[8] & 0x7f) << 7)
           | ((header[7] & 0x7f) << 14)
           | ((header[6] & 0x7f) << 21);

  const mp3ID = getStr(0, 3, header);
  // current TAG version is ID3v2.3
  if (mp3ID === 'ID3' && header[3] === 3) {
    data = data.slice(10);
    // if there has extend tag header, skip it
    if ((header[5] & 0x40) === 0x40)
    {
      size -= 10;
      data = data.slice(10);
    }
    const tags = readFrame(data, size);
    resolve(tags);

  } else {
    throw new Error('the format of mp3 file is not correct or there has no id3v2.3 tag!')
  }
}

function readFrame(data, size) {
  var frame, frameID, imageData, tmp, encode, frameSize= 0, seek = 0, tags = Object.create(null);
  tags['PRIV'] = Object.create(null);
  while (seek < size) {
    frame = data.subarray(seek, seek + 10);
    encode = data[10];
    frameID = getStr(0, 4, frame);
    frameSize = frame[4] * 0x10000000 + frame[5] * 0x10000 + frame[6] * 0x100 + frame[7];
    if (frameSize == 0) break;
    seek += 10 + frameSize;
    tmp = data.subarray(seek - frameSize, seek);

    if (frameID === 'APIC') {
      const info = getImgIndex(tmp);
      imageData = tmp.subarray(info['i'], frameSize);
      tags[frameID] = imageData;
    } else if (frameID === 'PRIV') {
      parsePRIV(tmp, tags['PRIV']);
    } else {
      tags[frameID] = getTagData(tmp, encode, frameID);
    }
  }

  !Object.keys(tags['PRIV']).length && delete tags.PRIV;
  return tags;
}

function getTagData(data, encode, frameID) {
  let seek = 0;
  let tmp, tmpStr = '', hexStr;

  if ((encode === 0 || encode === 87) && data[0] !== 1) {
    while (seek < data.length) {
      if (data[seek] < 127 ) {
        tmpStr += String.fromCharCode(data[seek]);
        seek ++;
      } else {
        tmp = data.slice(seek, seek + 2);
        if (tmp.length == 1) {
          tmpStr += getStr(0, 1, tmp);
          seek ++;
        } else {
          hexStr = `%${tmp[0].toString(16)}%${tmp[1].toString(16)}`;
          tmpStr += gbk().decode(hexStr.toUpperCase());
          seek += 2;
        }
      }
    }
  }

  if (encode === 1 || (data[0] === 1 && encode === 0)) {
    // the utf-16 string begin with FF FE -> 255 254
    if (data.lastIndexOf(254) !== -1) {
      data = data.slice(data.lastIndexOf(254) + 1);
      data = new Uint16Array(data.buffer);
    }

    tmpStr = getStr(0, data.length, data);
  }

  tmpStr = filterStr(tmpStr);
  return tmpStr;
}
