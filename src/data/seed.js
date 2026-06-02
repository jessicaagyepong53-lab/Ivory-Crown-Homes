const mkT = (o) => ({ documents: [], ...o });

export const seedBlocks = [
  {
    bid: 1,
    name: "Buulaso Community 25",
    type: "block",
    units: [
      {
        uid: 101,
        name: "Room 1",
        type: "2-Bedroom",
        monthlyRent: 2500,
        tenants: [
          mkT({
            tid: "t101a",
            name: "Comfort Frimpong",
            phone: "0554064780",
            email: "",
            leaseStart: "2026-03-01",
            leaseEnd:   "2027-03-01",
            leaseStatus: "active",
            cancelReason: "",
            cancelDate: "",
            depositPaid: true,
            depositAmount: 2500,
            idType: "Ghana Card",
            idNumber: "GHA-715793333-3",
            occupation: "",
            employer: "",
            dob: "2003-12-27",
            emergencyName: "Park Inkyu",
            emergencyPhone: "0547676907",
            emergencyRelation: "Co-occupant",
            vehicles: "",
            moveInDate: "2026-03-01",
            notes: "12-month rent paid in full (01/03/2026 – 01/03/2027). Security deposit GHS 2,500 paid. Co-occupant: Park Inkyu (KOR-731155260-4, Korean national). Property: Flat 2, Buulaso Community 25, Accra. Unfurnished 2-bed flat with central water heater, reservoir tank, 2 bathrooms, balcony, CCTV and gate remote.",
          }),
        ],
      },
    ],
  },
];

export const seedMaint = [];
