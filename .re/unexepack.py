"""Unpack a Microsoft EXEPACK'd DOS executable into a raw memory image + relocation list."""
import struct
import sys


def unpack(path):
    d = open(path, 'rb').read()
    (sig, last, pages, nrel, hdrpara, minalloc, maxalloc, ss, sp, csum, ip, cs, reloff) = struct.unpack('<2s12H', d[:26])
    hdr = hdrpara * 16
    image = d[hdr:]
    ep = cs * 16  # EXEPACK block offset inside the image
    real_ip, real_cs, mem_start, exepack_size, real_sp, real_ss, dest_len, signature = struct.unpack('<7H2s', image[ep:ep + 16])
    assert signature == b'RB', signature

    src = bytearray(image[:ep])
    dst = bytearray(dest_len * 16)
    dst[:len(src)] = src
    i = len(src)
    while i > 0 and src[i - 1] == 0xFF:
        i -= 1
    j = len(dst)
    while True:
        i -= 1; cmd = src[i]
        i -= 1; hi = src[i]
        i -= 1; lo = src[i]
        length = (hi << 8) | lo
        if cmd & 0xFE == 0xB0:
            i -= 1; fill = src[i]
            for _ in range(length):
                j -= 1; dst[j] = fill
        elif cmd & 0xFE == 0xB2:
            for _ in range(length):
                i -= 1; j -= 1; dst[j] = src[i]
        else:
            raise ValueError('bad command %02x at %x' % (cmd, i))
        if cmd & 1:
            break
    assert i == j, (hex(i), hex(j))

    # Packed relocation table follows the "Packed file is corrupt" message in the stub.
    stub = image[ep:ep + exepack_size]
    k = stub.find(b'Packed file is corrupt') + len('Packed file is corrupt')
    relocs = []
    for seg in range(16):
        count, = struct.unpack('<H', stub[k:k + 2]); k += 2
        for _ in range(count):
            off, = struct.unpack('<H', stub[k:k + 2]); k += 2
            relocs.append(seg * 0x1000 * 16 + off)
    return {'image': bytes(dst), 'ip': real_ip, 'cs': real_cs, 'ss': real_ss, 'sp': real_sp, 'relocs': relocs}


if __name__ == '__main__':
    r = unpack(sys.argv[1])
    open(sys.argv[2], 'wb').write(r['image'])
    open(sys.argv[2] + '.relocs', 'w').write('\n'.join('%x' % x for x in r['relocs']))
    print(sys.argv[1], 'image', hex(len(r['image'])), 'entry %04x:%04x' % (r['cs'], r['ip']),
          'stack %04x:%04x' % (r['ss'], r['sp']), 'relocs', len(r['relocs']))
