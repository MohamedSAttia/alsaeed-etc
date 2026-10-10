// Clearly synthetic review data. No reference-book or question-bank content.
export const demoLearningRelease={
  "schemaVersion": "grc-private-release-v1",
  "revision": "synthetic-release-1",
  "releaseId": "release-synthetic-one",
  "releaseSha256": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
  "packageIds": [
    "grcp-full"
  ],
  "sourceHashes": {
    "questionCandidates": "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
    "reader": "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    "workbook": "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
  },
  "reader": {
    "schemaVersion": "grc-reader-nodes-v1",
    "publicationStatus": "released",
    "items": [
      {
        "id": "synthetic-lecture",
        "kind": "lecture",
        "availableLocales": [
          "ar",
          "en"
        ],
        "title": {
          "ar": "درس تجريبي: التعلّم بالقراءة",
          "en": "Synthetic lecture"
        },
        "contentRevision": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "objectives": {
          "ar": [
            "هدف تجريبي"
          ],
          "en": [
            "Synthetic objective"
          ]
        },
        "sections": [
          {
            "id": "synthetic-section-1",
            "title": {
              "ar": "القسم التجريبي 1",
              "en": "Synthetic section 1"
            },
            "body": {
              "ar": [
                {
                  "tag": "p",
                  "children": [
                    {
                      "text": "محتوى عربي تجريبي 1"
                    }
                  ]
                }
              ],
              "en": [
                {
                  "tag": "p",
                  "children": [
                    {
                      "text": "Synthetic English body 1"
                    },
                    {
                      "tag": "strong",
                      "children": [
                        {
                          "text": " emphasis"
                        }
                      ]
                    }
                  ]
                }
              ]
            },
            "references": [
              {
                "document": "synthetic_reference",
                "pdfPage": 1,
                "printedPage": 1,
                "section": "Synthetic section"
              }
            ]
          },
          {
            "id": "synthetic-section-2",
            "title": {
              "ar": "القسم التجريبي 2",
              "en": "Synthetic section 2"
            },
            "body": {
              "ar": [
                {
                  "tag": "p",
                  "children": [
                    {
                      "text": "محتوى عربي تجريبي 2"
                    }
                  ]
                }
              ],
              "en": [
                {
                  "tag": "p",
                  "children": [
                    {
                      "text": "Synthetic English body 2"
                    },
                    {
                      "tag": "strong",
                      "children": [
                        {
                          "text": " emphasis"
                        }
                      ]
                    }
                  ]
                }
              ]
            },
            "references": [
              {
                "document": "synthetic_reference",
                "pdfPage": 2,
                "printedPage": 2,
                "section": "Synthetic section"
              }
            ]
          }
        ]
      },
      {
        "id": "synthetic-arabic-note",
        "kind": "knowledge_note",
        "availableLocales": [
          "ar"
        ],
        "title": {
          "ar": "ملاحظة عربية تجريبية"
        },
        "contentRevision": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        "objectives": {
          "ar": []
        },
        "sections": [
          {
            "id": "synthetic-arabic-section",
            "title": {
              "ar": "قسم عربي تجريبي"
            },
            "body": {
              "ar": [
                {
                  "tag": "p",
                  "children": [
                    {
                      "text": "محتوى الملاحظة العربية فقط"
                    }
                  ]
                }
              ]
            },
            "references": [
              {
                "document": "synthetic_reference",
                "pdfPage": 3,
                "printedPage": 3,
                "section": "Synthetic note"
              }
            ]
          }
        ]
      }
    ]
  },
  "workbook": {
    "schemaVersion": "grc-workbook-v1",
    "publicationStatus": "released",
    "forms": [
      {
        "id": "SYNTHETIC-FORM-one",
        "kind": "blank_learning_workbook",
        "sourceToolId": "TOOL-synthetic-one",
        "element": "L1",
        "title": {
          "ar": "دفتر تجريبي أول",
          "en": "Synthetic workbook one"
        },
        "availableLocales": [
          "ar",
          "en"
        ],
        "fields": [
          {
            "id": "summary",
            "type": "text",
            "label": {
              "ar": "ملخص تجريبي",
              "en": "Synthetic summary"
            },
            "required": false
          },
          {
            "id": "notes",
            "type": "textarea",
            "label": {
              "ar": "ملاحظات تجريبية",
              "en": "Synthetic notes"
            },
            "required": false
          },
          {
            "id": "reviewDate",
            "type": "date",
            "label": {
              "ar": "تاريخ المراجعة التجريبي",
              "en": "Synthetic date"
            },
            "required": false
          },
          {
            "id": "rows",
            "type": "table",
            "label": {
              "ar": "صفوف التدريب",
              "en": "Synthetic rows"
            },
            "minRows": 0,
            "columns": [
              {
                "id": "entry",
                "type": "text",
                "label": {
                  "ar": "اسم البند التجريبي",
                  "en": "Synthetic entry"
                },
                "required": false
              },
              {
                "id": "details",
                "type": "textarea",
                "label": {
                  "ar": "تفاصيل البند التجريبي",
                  "en": "Synthetic details"
                },
                "required": false
              },
              {
                "id": "date",
                "type": "date",
                "label": {
                  "ar": "تاريخ البند",
                  "en": "Synthetic row date"
                },
                "required": false
              }
            ]
          }
        ],
        "defaultValues": {
          "summary": "",
          "notes": "",
          "reviewDate": "",
          "rows": []
        },
        "computedOutputs": [],
        "automatedProfessionalDecision": false,
        "references": [
          {
            "document": "synthetic_reference",
            "pdfPage": 1,
            "printedPage": 1,
            "section": "Synthetic section"
          }
        ],
        "recordContract": {
          "ownerId": "server assigned",
          "brandId": "allowlisted",
          "provenance": "user_entered_unverified or fictional_demo",
          "evidenceStatus": "not_verified by default",
          "demoStorage": "owner-scoped fictional namespace",
          "snapshotRevision": "immutable"
        },
        "demoNotice": {
          "ar": "مثال افتراضي لتجربة الواجهة فقط؛ لا يمثل سجلاً حقيقياً.",
          "en": "Fictional example only."
        },
        "release": {
          "published": false,
          "publicationApprovalRequired": true
        },
        "schemaRevision": "eaeebf1aded13a4b96d073d42041bdfaa58d072872e3edd559dbba8d134a2141"
      },
      {
        "id": "SYNTHETIC-FORM-two",
        "kind": "blank_learning_workbook",
        "sourceToolId": "TOOL-synthetic-two",
        "element": "L2",
        "title": {
          "ar": "دفتر تجريبي ثانٍ",
          "en": "Synthetic workbook two"
        },
        "availableLocales": [
          "ar",
          "en"
        ],
        "fields": [
          {
            "id": "summary",
            "type": "text",
            "label": {
              "ar": "ملخص تجريبي",
              "en": "Synthetic summary"
            },
            "required": false
          },
          {
            "id": "notes",
            "type": "textarea",
            "label": {
              "ar": "ملاحظات تجريبية",
              "en": "Synthetic notes"
            },
            "required": false
          },
          {
            "id": "reviewDate",
            "type": "date",
            "label": {
              "ar": "تاريخ المراجعة التجريبي",
              "en": "Synthetic date"
            },
            "required": false
          },
          {
            "id": "rows",
            "type": "table",
            "label": {
              "ar": "صفوف التدريب",
              "en": "Synthetic rows"
            },
            "minRows": 0,
            "columns": [
              {
                "id": "entry",
                "type": "text",
                "label": {
                  "ar": "اسم البند التجريبي",
                  "en": "Synthetic entry"
                },
                "required": false
              },
              {
                "id": "details",
                "type": "textarea",
                "label": {
                  "ar": "تفاصيل البند التجريبي",
                  "en": "Synthetic details"
                },
                "required": false
              },
              {
                "id": "date",
                "type": "date",
                "label": {
                  "ar": "تاريخ البند",
                  "en": "Synthetic row date"
                },
                "required": false
              }
            ]
          }
        ],
        "defaultValues": {
          "summary": "",
          "notes": "",
          "reviewDate": "",
          "rows": []
        },
        "computedOutputs": [],
        "automatedProfessionalDecision": false,
        "references": [
          {
            "document": "synthetic_reference",
            "pdfPage": 1,
            "printedPage": 1,
            "section": "Synthetic section"
          }
        ],
        "recordContract": {
          "ownerId": "server assigned",
          "brandId": "allowlisted",
          "provenance": "user_entered_unverified or fictional_demo",
          "evidenceStatus": "not_verified by default",
          "demoStorage": "owner-scoped fictional namespace",
          "snapshotRevision": "immutable"
        },
        "demoNotice": {
          "ar": "مثال افتراضي لتجربة الواجهة فقط؛ لا يمثل سجلاً حقيقياً.",
          "en": "Fictional example only."
        },
        "release": {
          "published": false,
          "publicationApprovalRequired": true
        },
        "schemaRevision": "eaeebf1aded13a4b96d073d42041bdfaa58d072872e3edd559dbba8d134a2141"
      },
      {
        "id": "SYNTHETIC-FORM-three",
        "kind": "blank_learning_workbook",
        "sourceToolId": "TOOL-synthetic-three",
        "element": "L3",
        "title": {
          "ar": "دفتر تجريبي ثالث",
          "en": "Synthetic workbook three"
        },
        "availableLocales": [
          "ar",
          "en"
        ],
        "fields": [
          {
            "id": "summary",
            "type": "text",
            "label": {
              "ar": "ملخص تجريبي",
              "en": "Synthetic summary"
            },
            "required": false
          },
          {
            "id": "notes",
            "type": "textarea",
            "label": {
              "ar": "ملاحظات تجريبية",
              "en": "Synthetic notes"
            },
            "required": false
          },
          {
            "id": "reviewDate",
            "type": "date",
            "label": {
              "ar": "تاريخ المراجعة التجريبي",
              "en": "Synthetic date"
            },
            "required": false
          },
          {
            "id": "rows",
            "type": "table",
            "label": {
              "ar": "صفوف التدريب",
              "en": "Synthetic rows"
            },
            "minRows": 0,
            "columns": [
              {
                "id": "entry",
                "type": "text",
                "label": {
                  "ar": "اسم البند التجريبي",
                  "en": "Synthetic entry"
                },
                "required": false
              },
              {
                "id": "details",
                "type": "textarea",
                "label": {
                  "ar": "تفاصيل البند التجريبي",
                  "en": "Synthetic details"
                },
                "required": false
              },
              {
                "id": "date",
                "type": "date",
                "label": {
                  "ar": "تاريخ البند",
                  "en": "Synthetic row date"
                },
                "required": false
              }
            ]
          }
        ],
        "defaultValues": {
          "summary": "",
          "notes": "",
          "reviewDate": "",
          "rows": []
        },
        "computedOutputs": [],
        "automatedProfessionalDecision": false,
        "references": [
          {
            "document": "synthetic_reference",
            "pdfPage": 1,
            "printedPage": 1,
            "section": "Synthetic section"
          }
        ],
        "recordContract": {
          "ownerId": "server assigned",
          "brandId": "allowlisted",
          "provenance": "user_entered_unverified or fictional_demo",
          "evidenceStatus": "not_verified by default",
          "demoStorage": "owner-scoped fictional namespace",
          "snapshotRevision": "immutable"
        },
        "demoNotice": {
          "ar": "مثال افتراضي لتجربة الواجهة فقط؛ لا يمثل سجلاً حقيقياً.",
          "en": "Fictional example only."
        },
        "release": {
          "published": false,
          "publicationApprovalRequired": true
        },
        "schemaRevision": "eaeebf1aded13a4b96d073d42041bdfaa58d072872e3edd559dbba8d134a2141"
      }
    ]
  }
};
