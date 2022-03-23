#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <deque>
#include <unordered_map>

#include "descriptor.h"

#define HID_INPUT 0x80
#define HID_OUTPUT 0x90
#define HID_FEATURE 0xB0
#define HID_COLLECTION 0xA0
#define HID_USAGE_PAGE 0x04
#define HID_REPORT_SIZE 0x74
#define HID_REPORT_ID 0x84
#define HID_REPORT_COUNT 0x94
#define HID_USAGE 0x08
#define HID_USAGE_MINIMUM 0x18
#define HID_USAGE_MAXIMUM 0x28

button_def_t buttons[NBUTTONS];

axis_def_t axes[4];  // X, Y, V, H

bool has_report_id;

// Kensington Slimblade
uint8_t report_descriptor[] = {
 0x05, 0x01,                    // Usage Page (Generic Desktop)        0
 0x09, 0x02,                    // Usage (Mouse)                       2
 0xa1, 0x01,                    // Collection (Application)            4
 0x09, 0x01,                    //  Usage (Pointer)                    6
 0xa1, 0x00,                    //  Collection (Physical)              8
 0x05, 0x09,                    //   Usage Page (Button)               10
 0x19, 0x01,                    //   Usage Minimum (1)                 12
 0x29, 0x02,                    //   Usage Maximum (2)                 14
 0x15, 0x00,                    //   Logical Minimum (0)               16
 0x25, 0x01,                    //   Logical Maximum (1)               18
 0x95, 0x02,                    //   Report Count (2)                  20
 0x75, 0x01,                    //   Report Size (1)                   22
 0x81, 0x02,                    //   Input (Data,Var,Abs)              24
 0x95, 0x01,                    //   Report Count (1)                  26
 0x75, 0x06,                    //   Report Size (6)                   28
 0x81, 0x03,                    //   Input (Cnst,Var,Abs)              30
 0x05, 0x01,                    //   Usage Page (Generic Desktop)      32
 0x09, 0x30,                    //   Usage (X)                         34
 0x09, 0x31,                    //   Usage (Y)                         36
 0x09, 0x38,                    //   Usage (Wheel)                     38
 0x15, 0x81,                    //   Logical Minimum (-127)            40
 0x25, 0x7f,                    //   Logical Maximum (127)             42
 0x75, 0x08,                    //   Report Size (8)                   44
 0x95, 0x03,                    //   Report Count (3)                  46
 0x81, 0x06,                    //   Input (Data,Var,Rel)              48
// 0x06, 0x00, 0xff,              //   Usage Page (Vendor Defined Page 1) 50
 0x05, 0x09,                    //   Usage Page (Button)               10
// 0x19, 0x01,                    //   Usage Minimum (1)                 53
// 0x29, 0x02,                    //   Usage Maximum (2)                 55
 0x19, 0x03,                    //   Usage Minimum (3)                 53
 0x29, 0x04,                    //   Usage Maximum (4)                 55
 0x15, 0x00,                    //   Logical Minimum (0)               57
 0x25, 0x01,                    //   Logical Maximum (1)               59
 0x95, 0x02,                    //   Report Count (2)                  61
 0x75, 0x01,                    //   Report Size (1)                   63
 0x81, 0x02,                    //   Input (Data,Var,Abs)              65
 0x95, 0x01,                    //   Report Count (1)                  67
 0x75, 0x06,                    //   Report Size (6)                   69
 0x81, 0x03,                    //   Input (Cnst,Var,Abs)              71
 0xc0,                          //  End Collection                     73
 0xc0,                          // End Collection                      74
};

void mark_button(uint32_t usage, uint8_t report_id, uint16_t bitpos) {
    printf("mark_button(%0lx, %0hhx, %0hx)\n", usage, report_id, bitpos);
    if (usage >> 16 == 0x09) {
        int n = (usage & 0xFFFF) - 1;
        if (n < NBUTTONS) {
            buttons[n].active = true;
            buttons[n].report_id = report_id;
            buttons[n].bitpos = bitpos;
        }
    }
}

void mark_axis(uint32_t usage, uint8_t report_id, uint16_t bitpos, uint16_t size) {
    printf("mark_axis(%0lx, %0hhx, %0hx, %0hx)\n", usage, report_id, bitpos, size);
    axis_def_t* axis = NULL;
    switch (usage) {
        case 0x00010030:
            axis = &axes[0];
            break;
        case 0x00010031:
            axis = &axes[1];
            break;
        case 0x00010038:
            axis = &axes[2];
            break;
        case 0x000C0238:
            axis = &axes[3];
            break;
    }
    if (axis != NULL) {
        axis->active = true;
        axis->report_id = report_id;
        axis->bitpos = bitpos;
        axis->size = size;
    }
}

void parse_descriptor() {
    int idx = 0;
    int len = sizeof(report_descriptor);

    uint8_t report_id = 0;
    std::unordered_map<uint8_t, uint16_t> bitpos;  // report_id -> bitpos
    uint32_t report_size = 0;
    uint32_t report_count = 0;
    uint32_t usage_page = 0;
    std::deque<uint32_t> usages;
    uint32_t usage_minimum = 0;
    uint32_t usage_maximum = 0;

    while (idx < len) {
        if (report_descriptor[idx] == 0 && idx == len - 1) {
            continue;
        }

        uint8_t item = report_descriptor[idx] & 0xFC;
        uint8_t item_size = report_descriptor[idx] & 0x03;
        if (item_size == 3) {
            item_size = 4;
        }
        uint32_t value = 0;
        idx++;
        for (int i = 0; i < item_size; i++) {
            value |= report_descriptor[idx++] << (i * 8);
        }

        switch (item) {
            case HID_INPUT: {
                printf("Input %0lx\n", value);

                if ((value & 0x03) == 0x02) {
                    if (usage_minimum && usage_maximum) {
                        uint32_t usage = usage_minimum;
                        for (uint i = 0; i < report_count; i++) {
                            mark_button(usage, report_id, bitpos[report_id]);
                            mark_axis(usage, report_id, bitpos[report_id], report_size);
                            if (usage < usage_maximum) {
                                usage++;
                            }
                            bitpos[report_id] += report_size;
                        }
                    } else if (!usages.empty()) {
                        uint32_t usage = 0;
                        for (uint i = 0; i < report_count; i++) {
                            if (!usages.empty()) {
                                usage = usages.front();
                                usages.pop_front();
                            }
                            mark_button(usage, report_id, bitpos[report_id]);
                            mark_axis(usage, report_id, bitpos[report_id], report_size);
                            bitpos[report_id] += report_size;
                        }
                    } else {
                        bitpos[report_id] += report_size * report_count;
                    }
                } else {
                    bitpos[report_id] += report_size * report_count;
                }

                usages.clear();
                usage_minimum = 0;
                usage_maximum = 0;
                break;
            }
            case HID_COLLECTION:
            case HID_OUTPUT:
            case HID_FEATURE:
                usages.clear();
                usage_minimum = 0;
                usage_maximum = 0;
                break;
            case HID_USAGE_PAGE:
                printf("Usage page %0lx\n", value);
                usage_page = value;
                break;
            case HID_REPORT_SIZE:
                printf("Report size %0lx\n", value);
                report_size = value;
                break;
            case HID_REPORT_ID:
                printf("Report ID %0lx\n", value);
                report_id = value;
                has_report_id = true;
                break;
            case HID_REPORT_COUNT:
                printf("Report count %0lx\n", value);
                report_count = value;
                break;
            case HID_USAGE: {
                printf("Usage %0lx\n", value);
                uint32_t full_usage = item_size <= 2 ? usage_page << 16 | value : value;
                usages.push_back(full_usage);
                break;
            }
            case HID_USAGE_MINIMUM: {
                printf("Usage minimum %0lx\n", value);
                uint32_t full_usage = item_size <= 2 ? usage_page << 16 | value : value;
                usage_minimum = full_usage;
                break;
            }
            case HID_USAGE_MAXIMUM: {
                printf("Usage maximum %0lx\n", value);
                uint32_t full_usage = item_size <= 2 ? usage_page << 16 | value : value;
                usage_maximum = full_usage;
                break;
            }
        }
    }
}

void clear_descriptor_data() {
    for (int i = 0; i < NBUTTONS; i++) {
        buttons[i].active = false;
    }
    for (int i = 0; i < 4; i++) {
        axes[i].active = false;
    }
    has_report_id = false;
}
