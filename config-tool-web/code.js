const config_version = 1;
let device = null;

const axis_options = [
    ["None", "0"],
    ["Cursor X", "1"],
    ["Cursor Y", "2"],
    ["V scroll", "3"],
    ["H scroll", "4"],
    ["Cursor X (inverted)", "-1"],
    ["Cursor Y (inverted)", "-2"],
    ["V scroll (inverted)", "-3"],
    ["H scroll (inverted)", "-4"],
];

const button_options = [
    ["None", "0"],
    ["Button 1 (left)", "1"],
    ["Button 2 (right)", "2"],
    ["Button 3 (middle)", "3"],
    ["Button 4 (back)", "4"],
    ["Button 5 (forward)", "5"],
    ["Button 6", "6"],
    ["Button 7", "7"],
    ["Button 8", "8"],
    ["Click-drag", "9"],
    ["Shift", "10"],
];

function clear_error() {
    document.getElementById("error").classList.add("d-none");
}

function display_error(message) {
    document.getElementById("error").innerText = message;
    document.getElementById("error").classList.remove("d-none");
}

async function open_device() {
    clear_error();
    let success = false;
    const devices = await navigator.hid.requestDevice({
        filters: [{ vendorId: 0xCAFE, productId: 0xBAF1 }]
    }).catch((err) => { display_error(err); });
    if (devices !== undefined && devices.length > 0) {
        device = devices[0];
        if (!device.opened) {
            await device.open().catch((err) => { display_error(err + "\nIf you're on Linux, you might need to give yourself permissions to the appropriate /dev/hidraw* device."); });
        }
        success = device.opened;
    }
    document.getElementById("load_from_device").disabled = !success;
    document.getElementById("save_to_device").disabled = !success;
    if (!success) {
        device = null;
    }
}

async function load_from_device() {
    if (device == null) {
        return;
    }
    clear_error();

    const data = await device.receiveFeatureReport(3).catch((err) => { display_error(err); });

    if (data === undefined) {
        return;
    }

    let idx = 0;
    idx++; // report ID
    if (data.getUint8(idx++) != config_version) {
        display_error("Incompatible config version received from device.");
        return;
    }
    idx++; // config command

    for (const prefix of ["", "shifted_"]) {
        for (let i = 0; i < 4; i++) {
            document.getElementById("axis_" + prefix + i).value = data.getUint8(idx++);
        }
    }
    for (const prefix of ["", "shifted_"]) {
        for (let i = 0; i < 8; i++) {
            document.getElementById("button_" + prefix + i).value = data.getUint8(idx++);
        }
    }
}

async function save_to_device() {
    if (device == null) {
        return;
    }
    clear_error();

    let data = [];
    data.push(0x01); // config version
    data.push(0x00); // config command
    for (const prefix of ["", "shifted_"]) {
        for (let i = 0; i < 4; i++) {
            data.push(parseInt(document.getElementById("axis_" + prefix + i).value, 10));
        }
    }
    for (const prefix of ["", "shifted_"]) {
        for (let i = 0; i < 8; i++) {
            data.push(parseInt(document.getElementById("button_" + prefix + i).value, 10));
        }
    }

    let crc = crc32(data);
    data.push(crc & 0xff);
    data.push((crc >>> 8) & 0xff);
    data.push((crc >>> 16) & 0xff);
    data.push((crc >>> 24) & 0xff);

    await device.sendFeatureReport(3, Uint8Array.from(data)).catch((err) => { display_error(err); });
}

const crc_table = [
    0x0, 0x77073096, 0xEE0E612C, 0x990951BA, 0x76DC419, 0x706AF48F, 0xE963A535,
    0x9E6495A3, 0xEDB8832, 0x79DCB8A4, 0xE0D5E91E, 0x97D2D988, 0x9B64C2B,
    0x7EB17CBD, 0xE7B82D07, 0x90BF1D91, 0x1DB71064, 0x6AB020F2, 0xF3B97148,
    0x84BE41DE, 0x1ADAD47D, 0x6DDDE4EB, 0xF4D4B551, 0x83D385C7, 0x136C9856,
    0x646BA8C0, 0xFD62F97A, 0x8A65C9EC, 0x14015C4F, 0x63066CD9, 0xFA0F3D63,
    0x8D080DF5, 0x3B6E20C8, 0x4C69105E, 0xD56041E4, 0xA2677172, 0x3C03E4D1,
    0x4B04D447, 0xD20D85FD, 0xA50AB56B, 0x35B5A8FA, 0x42B2986C, 0xDBBBC9D6,
    0xACBCF940, 0x32D86CE3, 0x45DF5C75, 0xDCD60DCF, 0xABD13D59, 0x26D930AC,
    0x51DE003A, 0xC8D75180, 0xBFD06116, 0x21B4F4B5, 0x56B3C423, 0xCFBA9599,
    0xB8BDA50F, 0x2802B89E, 0x5F058808, 0xC60CD9B2, 0xB10BE924, 0x2F6F7C87,
    0x58684C11, 0xC1611DAB, 0xB6662D3D, 0x76DC4190, 0x1DB7106, 0x98D220BC,
    0xEFD5102A, 0x71B18589, 0x6B6B51F, 0x9FBFE4A5, 0xE8B8D433, 0x7807C9A2,
    0xF00F934, 0x9609A88E, 0xE10E9818, 0x7F6A0DBB, 0x86D3D2D, 0x91646C97,
    0xE6635C01, 0x6B6B51F4, 0x1C6C6162, 0x856530D8, 0xF262004E, 0x6C0695ED,
    0x1B01A57B, 0x8208F4C1, 0xF50FC457, 0x65B0D9C6, 0x12B7E950, 0x8BBEB8EA,
    0xFCB9887C, 0x62DD1DDF, 0x15DA2D49, 0x8CD37CF3, 0xFBD44C65, 0x4DB26158,
    0x3AB551CE, 0xA3BC0074, 0xD4BB30E2, 0x4ADFA541, 0x3DD895D7, 0xA4D1C46D,
    0xD3D6F4FB, 0x4369E96A, 0x346ED9FC, 0xAD678846, 0xDA60B8D0, 0x44042D73,
    0x33031DE5, 0xAA0A4C5F, 0xDD0D7CC9, 0x5005713C, 0x270241AA, 0xBE0B1010,
    0xC90C2086, 0x5768B525, 0x206F85B3, 0xB966D409, 0xCE61E49F, 0x5EDEF90E,
    0x29D9C998, 0xB0D09822, 0xC7D7A8B4, 0x59B33D17, 0x2EB40D81, 0xB7BD5C3B,
    0xC0BA6CAD, 0xEDB88320, 0x9ABFB3B6, 0x3B6E20C, 0x74B1D29A, 0xEAD54739,
    0x9DD277AF, 0x4DB2615, 0x73DC1683, 0xE3630B12, 0x94643B84, 0xD6D6A3E,
    0x7A6A5AA8, 0xE40ECF0B, 0x9309FF9D, 0xA00AE27, 0x7D079EB1, 0xF00F9344,
    0x8708A3D2, 0x1E01F268, 0x6906C2FE, 0xF762575D, 0x806567CB, 0x196C3671,
    0x6E6B06E7, 0xFED41B76, 0x89D32BE0, 0x10DA7A5A, 0x67DD4ACC, 0xF9B9DF6F,
    0x8EBEEFF9, 0x17B7BE43, 0x60B08ED5, 0xD6D6A3E8, 0xA1D1937E, 0x38D8C2C4,
    0x4FDFF252, 0xD1BB67F1, 0xA6BC5767, 0x3FB506DD, 0x48B2364B, 0xD80D2BDA,
    0xAF0A1B4C, 0x36034AF6, 0x41047A60, 0xDF60EFC3, 0xA867DF55, 0x316E8EEF,
    0x4669BE79, 0xCB61B38C, 0xBC66831A, 0x256FD2A0, 0x5268E236, 0xCC0C7795,
    0xBB0B4703, 0x220216B9, 0x5505262F, 0xC5BA3BBE, 0xB2BD0B28, 0x2BB45A92,
    0x5CB36A04, 0xC2D7FFA7, 0xB5D0CF31, 0x2CD99E8B, 0x5BDEAE1D, 0x9B64C2B0,
    0xEC63F226, 0x756AA39C, 0x26D930A, 0x9C0906A9, 0xEB0E363F, 0x72076785,
    0x5005713, 0x95BF4A82, 0xE2B87A14, 0x7BB12BAE, 0xCB61B38, 0x92D28E9B,
    0xE5D5BE0D, 0x7CDCEFB7, 0xBDBDF21, 0x86D3D2D4, 0xF1D4E242, 0x68DDB3F8,
    0x1FDA836E, 0x81BE16CD, 0xF6B9265B, 0x6FB077E1, 0x18B74777, 0x88085AE6,
    0xFF0F6A70, 0x66063BCA, 0x11010B5C, 0x8F659EFF, 0xF862AE69, 0x616BFFD3,
    0x166CCF45, 0xA00AE278, 0xD70DD2EE, 0x4E048354, 0x3903B3C2, 0xA7672661,
    0xD06016F7, 0x4969474D, 0x3E6E77DB, 0xAED16A4A, 0xD9D65ADC, 0x40DF0B66,
    0x37D83BF0, 0xA9BCAE53, 0xDEBB9EC5, 0x47B2CF7F, 0x30B5FFE9, 0xBDBDF21C,
    0xCABAC28A, 0x53B39330, 0x24B4A3A6, 0xBAD03605, 0xCDD70693, 0x54DE5729,
    0x23D967BF, 0xB3667A2E, 0xC4614AB8, 0x5D681B02, 0x2A6F2B94, 0xB40BBE37,
    0xC30C8EA1, 0x5A05DF1B, 0x2D02EF8D
];

function crc32(buf) {
    let c = 0xffffffff;
    for (let n = 0; n < buf.length; n++) {
        c = crc_table[(c ^ buf[n]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
}

document.addEventListener("DOMContentLoaded", function () {
    for (const prefix of ["", "shifted_"]) {
        for (let i = 0; i < 4; i++) {
            const element = document.getElementById("axis_" + prefix + i);
            for (const option of axis_options) {
                element.add(new Option(option[0], option[1]), undefined);
            }
        }
        for (let i = 0; i < 8; i++) {
            const element = document.getElementById("button_" + prefix + i);
            for (const option of button_options) {
                element.add(new Option(option[0], option[1]), undefined);
            }
        }
    }

    document.getElementById("open_device").addEventListener("click", open_device);
    document.getElementById("load_from_device").addEventListener("click", load_from_device);
    document.getElementById("save_to_device").addEventListener("click", save_to_device);

    document.getElementById("load_from_device").disabled = true;
    document.getElementById("save_to_device").disabled = true;
});