/**
 * Regional Indian Language Translation Engine & High-Fidelity Demo Proposal
 * Supported Languages: English (en), Hindi (hi), Bangla (bn), Marathi (mr), Gujarati (gu)
 */

export const REGIONAL_LANGUAGES = [
  { code: 'en', label: 'English', native: 'English', flag: 'EN' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी', flag: 'HI' },
  { code: 'bn', label: 'Bangla', native: 'বাংলা', flag: 'BN' },
  { code: 'mr', label: 'Marathi', native: 'मराठी', flag: 'MR' },
  { code: 'gu', label: 'Gujarati', native: 'ગુજરાતી', flag: 'GU' },
];

export const UI_TRANSLATIONS = {
  en: {
    itineraryOverview: 'Itinerary Overview',
    includedInTrip: 'Included in your trip',
    mapLocation: 'Map & Live Location',
    weatherForecast: 'Weather Forecast',
    totalCost: 'Total Cost',
    subtotal: 'Subtotal',
    showPricing: 'Show Pricing',
    requestChanges: 'Request Changes',
    approveProposal: 'Approve Proposal',
    approvedStatus: 'Approved & DPDP Recorded',
    changesRequestedStatus: 'Changes Requested',
    preparedFor: 'Prepared for',
    travelers: 'Travelers',
    daysCount: 'Days',
    expandAll: 'Expand All',
    collapseAll: 'Collapse All',
    dayBadge: 'Day',
    viewOnGoogleMaps: 'View on Google Maps',
    liveLocationLabel: 'Live Destination Coordinates',
    // Modals
    approveModalTitle: 'Approve Travel Proposal',
    dpdpConsentLabel: 'I consent under the Digital Personal Data Protection (DPDP) Act 2023 to record this approval with timestamp and secure system audit log.',
    fullNameLabel: 'Full Legal Name',
    fullNamePlaceholder: 'Enter your full name',
    confirmApproveBtn: 'Confirm & Approve Proposal',
    cancelBtn: 'Cancel',
    modifyModalTitle: 'Request Modifications',
    modifyCategoriesLabel: 'Select areas to modify:',
    modifyCategoryHotels: 'Hotels & Accommodation',
    modifyCategoryFlights: 'Flights & Transit',
    modifyCategoryDates: 'Travel Dates',
    modifyCategoryBudget: 'Budget & Pricing',
    feedbackNotesLabel: 'Detailed Feedback / Instructions',
    feedbackNotesPlaceholder: 'Tell us what changes you would like us to make...',
    submitChangesBtn: 'Submit Modification Request',
    processing: 'Processing...',
    demoBanner: 'Viewing Demo Proposal • Switch languages above to experience full-page regional translation',
    humidity: 'Humidity',
    wind: 'Wind Speed',
    currentWeather: 'Current Weather',
  },
  hi: {
    itineraryOverview: 'यात्रा कार्यक्रम (इटिनरेरी)',
    includedInTrip: 'आपकी यात्रा में शामिल सुविधाएँ',
    mapLocation: 'मानचित्र और लाइव स्थान',
    weatherForecast: 'मौसम का पूर्वानुमान',
    totalCost: 'कुल लागत',
    subtotal: 'उप-योग (Subtotal)',
    showPricing: 'मूल्य दिखाएँ',
    requestChanges: 'बदलाव का अनुरोध करें',
    approveProposal: 'प्रस्ताव स्वीकृत करें',
    approvedStatus: 'स्वीकृत और DPDP दर्ज किया गया',
    changesRequestedStatus: 'बदलाव का अनुरोध किया गया',
    preparedFor: 'के लिए तैयार किया गया:',
    travelers: 'यात्री',
    daysCount: 'दिन',
    expandAll: 'सभी विस्तार करें',
    collapseAll: 'सभी समेटें',
    dayBadge: 'दिन',
    viewOnGoogleMaps: 'गूगल मैप्स पर देखें',
    liveLocationLabel: 'लाइव गंतव्य निर्देशांक',
    approveModalTitle: 'यात्रा प्रस्ताव की स्वीकृति',
    dpdpConsentLabel: 'मैं डिजिटल पर्सनल डेटा प्रोटेक्शन (DPDP) अधिनियम 2023 के तहत टाइमस्टैम्प और सुरक्षित सिस्टम ऑडिट लॉग के साथ इस स्वीकृति को दर्ज करने की सहमति देता/देती हूँ।',
    fullNameLabel: 'पूरा कानूनी नाम',
    fullNamePlaceholder: 'अपना पूरा नाम दर्ज करें',
    confirmApproveBtn: 'पुष्टि करें और स्वीकृत करें',
    cancelBtn: 'रद्द करें',
    modifyModalTitle: 'बदलाव का अनुरोध करें',
    modifyCategoriesLabel: 'संशोधन के क्षेत्र चुनें:',
    modifyCategoryHotels: 'होटल और आवास',
    modifyCategoryFlights: 'उड़ानें और परिवहन',
    modifyCategoryDates: 'यात्रा की तिथियाँ',
    modifyCategoryBudget: 'बजट और मूल्य निर्धारण',
    feedbackNotesLabel: 'विस्तृत प्रतिक्रिया / निर्देश',
    feedbackNotesPlaceholder: 'हमें बताएं कि आप क्या बदलाव चाहते हैं...',
    submitChangesBtn: 'संशोधन अनुरोध सबमिट करें',
    processing: 'प्रक्रिया जारी है...',
    demoBanner: 'डेमो प्रस्ताव देखा जा रहा है • पूर्ण क्षेत्रीय अनुवाद अनुभव के लिए ऊपर भाषा बदलें',
    humidity: 'आर्द्रता',
    wind: 'हवा की गति',
    currentWeather: 'वर्तमान मौसम',
  },
  bn: {
    itineraryOverview: 'ভ্রমণ সূচী (ইটিনেরারি)',
    includedInTrip: 'আপনার ভ্রমণে অন্তর্ভুক্ত সুবিধাসমূহ',
    mapLocation: 'মানচিত্র ও লাইভ অবস্থান',
    weatherForecast: 'আবহাওয়ার পূর্বাভাস',
    totalCost: 'মোট খরচ',
    subtotal: 'উপমোট (Subtotal)',
    showPricing: 'মূল্য প্রদর্শন করুন',
    requestChanges: 'পরিবর্তনের অনুরোধ করুন',
    approveProposal: 'প্রস্তাব অনুমোদন করুন',
    approvedStatus: 'অনুমোদিত এবং DPDP রেকর্ড করা হয়েছে',
    changesRequestedStatus: 'পরিবর্তনের অনুরোধ করা হয়েছে',
    preparedFor: 'প্রস্তুত করা হয়েছে:',
    travelers: 'যাত্রী',
    daysCount: 'দিন',
    expandAll: 'সবগুলো খুলুন',
    collapseAll: 'সবগুলো বন্ধ করুন',
    dayBadge: 'দিন',
    viewOnGoogleMaps: 'গুগল ম্যাপে দেখুন',
    liveLocationLabel: 'লাইভ গন্তব্য স্থানাঙ্ক',
    approveModalTitle: 'ভ্রমণ প্রস্তাব অনুমোদন',
    dpdpConsentLabel: 'আমি ডিজিটাল পার্সোনাল ডেটা প্রোটেকশন (DPDP) আইন ২০২৩ এর অধীনে টাইমস্ট্যাম্প ও সুরক্ষিত অডিট লগ সহ এই অনুমোদন রেকর্ড করার সম্মতি দিচ্ছি।',
    fullNameLabel: 'পূর্ণ আইনগত নাম',
    fullNamePlaceholder: 'আপনার সম্পূর্ণ নাম লিখুন',
    confirmApproveBtn: 'নিশ্চিত ও অনুমোদন করুন',
    cancelBtn: 'বাতিল করুন',
    modifyModalTitle: 'পরিবর্তনের অনুরোধ করুন',
    modifyCategoriesLabel: 'পরিবর্তনের ক্ষেত্র নির্বাচন করুন:',
    modifyCategoryHotels: 'হোটেল এবং আবাসন',
    modifyCategoryFlights: 'ফ্লাইট এবং পরিবহন',
    modifyCategoryDates: 'ভ্রমণের তারিখ',
    modifyCategoryBudget: 'বাজেট এবং মূল্য',
    feedbackNotesLabel: 'বিস্তারিত মতামত / নির্দেশাবলি',
    feedbackNotesPlaceholder: 'আপনি কী পরিবর্তন করতে চান আমাদের জানান...',
    submitChangesBtn: 'পরিবর্তন অনুরোধ জমা দিন',
    processing: 'প্রক্রিয়াধীন...',
    demoBanner: 'ডেমো প্রস্তাব প্রদর্শিত হচ্ছে • সম্পূর্ণ আঞ্চলিক অনুবাদের জন্য উপরের ভাষা পরিবর্তন করুন',
    humidity: 'আর্দ্রতা',
    wind: 'বাতাসের গতি',
    currentWeather: 'বর্তমান আবহাওয়া',
  },
  mr: {
    itineraryOverview: 'प्रवास योजना (Itinerary)',
    includedInTrip: 'तुमच्या सहलीत समाविष्ट असलेल्या सुविधा',
    mapLocation: 'नकाशा आणि थेट स्थान',
    weatherForecast: 'हवामानाचा अंदाज',
    totalCost: 'एकूण खर्च',
    subtotal: 'उप-एकूण (Subtotal)',
    showPricing: 'किंमती दाखवा',
    requestChanges: 'बदलांची विनंती करा',
    approveProposal: 'प्रस्ताव मंजूर करा',
    approvedStatus: 'मंजूर आणि DPDP नोंदणीकृत',
    changesRequestedStatus: 'बदलांची विनंती केली',
    preparedFor: 'यांच्यासाठी तयार केले:',
    travelers: 'प्रवासी',
    daysCount: 'दिवस',
    expandAll: 'सर्व विस्तृत करा',
    collapseAll: 'सर्व संक्षिप्त करा',
    dayBadge: 'दिवस',
    viewOnGoogleMaps: 'गुगल मॅप्सवर पहा',
    liveLocationLabel: 'थेट गंतव्य समन्वय',
    approveModalTitle: 'प्रवास प्रस्तावाची मंजुरी',
    dpdpConsentLabel: 'मी डिजिटल पर्सनल डेटा प्रोटेक्शन (DPDP) कायदा 2023 अंतर्गत टाइमस्टॅम्प आणि सुरक्षित सिस्टम ऑडिट लॉगसह ही मंजुरी नोंदविण्यास संमती देतो/देते.',
    fullNameLabel: 'पूर्ण कायदेशीर नाव',
    fullNamePlaceholder: 'तुमचे पूर्ण नाव प्रविष्ट करा',
    confirmApproveBtn: 'पुष्टी करा आणि मंजूर करा',
    cancelBtn: 'रद्द करा',
    modifyModalTitle: 'बदलांची विनंती करा',
    modifyCategoriesLabel: 'सुधारणा करण्यासाठी क्षेत्रे निवडा:',
    modifyCategoryHotels: 'हॉटेल आणि निवास',
    modifyCategoryFlights: 'विमान आणि वाहतूक',
    modifyCategoryDates: 'प्रवासाच्या तारखा',
    modifyCategoryBudget: 'बजट आणि किंमत',
    feedbackNotesLabel: 'सविस्तर अभिप्राय / सूचना',
    feedbackNotesPlaceholder: 'तुम्हाला कोणते बदल हवे आहेत ते आम्हाला सांगा...',
    submitChangesBtn: 'बदलाची विनंती सबमिट करा',
    processing: 'प्रक्रिया सुरू आहे...',
    demoBanner: 'डेमो प्रस्ताव पाहत आहात • पूर्ण प्रादेशिक भाषांतरासाठी वरील भाषा बदला',
    humidity: 'आर्द्रता',
    wind: 'वाऱ्याचा वेग',
    currentWeather: 'सध्याचे हवामान',
  },
  gu: {
    itineraryOverview: 'પ્રવાસ કાર્યક્રમ (ઇટિનરેરી)',
    includedInTrip: 'તમારી યાત્રામાં સમાવિષ્ટ સુવિધાઓ',
    mapLocation: 'નકશો અને લાઇવ લોકેશન',
    weatherForecast: 'હવામાનની આગાહી',
    totalCost: 'કુલ ખર્ચ',
    subtotal: 'પેટા-સરવાળો (Subtotal)',
    showPricing: 'કિંમતો બતાવો',
    requestChanges: 'ફેરફારની વિનંતી કરો',
    approveProposal: 'પ્રસ્તાવ મંજૂર કરો',
    approvedStatus: 'મંજૂર અને DPDP નોંધાયેલ',
    changesRequestedStatus: 'ફેરફારની વિનંતી કરી',
    preparedFor: 'માટે તૈયાર કરવામાં આવ્યું:',
    travelers: 'મુસાફરો',
    daysCount: 'દિવસો',
    expandAll: 'બધું વિસ્તૃત કરો',
    collapseAll: 'બધું સંકેલો',
    dayBadge: 'દિવસ',
    viewOnGoogleMaps: 'ગુગલ મેપ્સ પર જુઓ',
    liveLocationLabel: 'લાઇવ ગંતવ્ય કોઓર્ડિનેટ્સ',
    approveModalTitle: 'પ્રવાસ પ્રસ્તાવની મંજૂરી',
    dpdpConsentLabel: 'હું ડિજિટલ પર્સનલ ડેટા પ્રોટેક્શન (DPDP) કાયદા 2023 હેઠળ ટાઇમસ્ટેમ્પ અને સુરક્ષિત સિસ્ટમ ઓડિટ લોગ સાથે આ મંજૂરી રેકોર્ડ કરવાની સંમતિ આપું છું.',
    fullNameLabel: 'સંપૂર્ણ કાનૂની નામ',
    fullNamePlaceholder: 'તમારું પૂરું નામ દાખલ કરો',
    confirmApproveBtn: 'પુષ્ટિ કરો અને મંજૂર કરો',
    cancelBtn: 'રદ કરો',
    modifyModalTitle: 'ફેરફારની વિનંતી કરો',
    modifyCategoriesLabel: 'સુધારા માટે ક્ષેત્રો પસંદ કરો:',
    modifyCategoryHotels: 'હોટલ અને રહેઠાણ',
    modifyCategoryFlights: 'ફ્લાઇટ્સ અને ટ્રાન્સપોર્ટ',
    modifyCategoryDates: 'પ્રવાસની તારીખો',
    modifyCategoryBudget: 'બજેટ અને કિંમત',
    feedbackNotesLabel: 'વિગતવાર પ્રતિસાદ / સૂચનાઓ',
    feedbackNotesPlaceholder: 'અમને જણાવો કે તમે કયા ફેરફારો કરવા માંગો છો...',
    submitChangesBtn: 'ફેરફાર વિનંતી સબમિટ કરો',
    processing: 'પ્રક્રિયા ચાલુ છે...',
    demoBanner: 'ડેમો પ્રસ્તાવ જોઈ રહ્યા છો • સંપૂર્ણ પ્રાદેશિક અનુવાદ માટે ઉપરની ભાષા બદલો',
    humidity: 'ભેજ',
    wind: 'પવનની ગતિ',
    currentWeather: 'વર્તમાન હવામાન',
  },
};

/**
 * High-fidelity Demo Proposal with multilingual full-page translations
 */
export const MULTILINGUAL_DEMO_PROPOSALS = {
  en: {
    id: 'demo-royal-rajasthan',
    name: 'Royal Rajasthan Heritage & Palace Odyssey',
    destination: 'Jaipur & Udaipur, India',
    client_name: 'Aditya & Ananya Sharma',
    travelers: 2,
    currency: 'INR',
    heroImages: [
      'https://images.unsplash.com/photo-1599661046289-e31897846e41?w=1200&q=80', // Hawa Mahal Jaipur
      'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=1200&q=80', // Udaipur Lake Palace
      'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=1200&q=80', // Amer Fort Jaipur
    ],
    trip_details: {
      days: [
        {
          title: 'Arrival in Pink City Jaipur & Amber Fort Sunset',
          description: 'Welcome to Jaipur! Check in to your royal palace heritage hotel. Afternoon private guided excursion to the magnificent Amber Fort overlooking Maota Lake, followed by a traditional Rajasthani dinner at Chokhi Dhani under starry skies.',
          images: [
            'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=800&q=80',
            'https://images.unsplash.com/photo-1599661046289-e31897846e41?w=800&q=80',
            'https://images.unsplash.com/photo-1609766857041-ed402ea8069a?w=800&q=80',
          ],
        },
        {
          title: 'City Palace, Jantar Mantar & Hawa Mahal Excursion',
          description: 'Full day royal Jaipur heritage discovery. Visit the opulent City Palace museum, astronomical observatory Jantar Mantar, and marvel at the iconic facade of Hawa Mahal. Evening leisurely shopping in Johari Bazaar.',
          images: [
            'https://images.unsplash.com/photo-1599661046289-e31897846e41?w=800&q=80',
            'https://images.unsplash.com/photo-1623492701902-47dc207df5dc?w=800&q=80',
          ],
        },
        {
          title: 'Scenic Luxury Transit to Udaipur City of Lakes',
          description: 'Private chauffeur scenic drive through the Aravalli hills to Udaipur. Check in to your lakeside palace retreat on Lake Pichola. Evening romantic sunset boat cruise taking in Jag Mandir and City Palace illuminations.',
          images: [
            'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=800&q=80',
            'https://images.unsplash.com/photo-1615880484746-a134be9a6ecf?w=800&q=80',
          ],
        },
        {
          title: 'Udaipur City Palace & Saheliyon-ki-Bari Royal Gardens',
          description: 'Guided tour of the majestic Udaipur City Palace complex and crystal gallery. Walk through the lush royal fountains of Saheliyon-ki-Bari before your return flight home.',
          images: [
            'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=800&q=80',
            'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?w=800&q=80',
          ],
        },
      ],
    },
    items: [
      {
        id: 'hotel-jaipur',
        name: 'Rambagh Palace Heritage Suite, Jaipur',
        kind: 'hotel',
        qty: 2,
        unit_price: 38000,
        images: [
          'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80',
          'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&q=80',
          'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&q=80',
        ],
      },
      {
        id: 'hotel-udaipur',
        name: 'Taj Lake Palace Luxury Suite, Udaipur',
        kind: 'hotel',
        qty: 2,
        unit_price: 45000,
        images: [
          'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=800&q=80',
          'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&q=80',
        ],
      },
      {
        id: 'flight-return',
        name: 'Vistara Executive Flight & Private Chauffeur Transit',
        kind: 'flight',
        qty: 2,
        unit_price: 12500,
        images: [
          'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=800&q=80',
        ],
      },
      {
        id: 'activity-boat',
        name: 'Private Lake Pichola Sunset Cruise & Heritage Guide',
        kind: 'activity',
        qty: 1,
        unit_price: 8500,
        images: [
          'https://images.unsplash.com/photo-1615880484746-a134be9a6ecf?w=800&q=80',
        ],
      },
    ],
  },
  hi: {
    id: 'demo-royal-rajasthan',
    name: 'रॉयल राजस्थान हेरिटेज एवं पैलेस यात्रा',
    destination: 'जयपुर एवं उदयपुर, भारत',
    client_name: 'आदित्य एवं अनन्य शर्मा',
    travelers: 2,
    currency: 'INR',
    heroImages: [
      'https://images.unsplash.com/photo-1599661046289-e31897846e41?w=1200&q=80',
      'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=1200&q=80',
      'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=1200&q=80',
    ],
    trip_details: {
      days: [
        {
          title: 'गुलाबी शहर जयपुर आगमन एवं आमेर किला सूर्यास्त',
          description: 'जयपुर में आपका स्वागत है! अपने शाही हेरिटेज होटल में चेक-इन करें। दोपहर में माओटा झील के ऊपर स्थित भव्य आमेर किले का निजी निर्देशित भ्रमण, जिसके बाद तारों की छांव में चौकी ढाणी में पारंपरिक राजस्थानी रात्रिभोज का आनंद लें।',
          images: [
            'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=800&q=80',
            'https://images.unsplash.com/photo-1599661046289-e31897846e41?w=800&q=80',
            'https://images.unsplash.com/photo-1609766857041-ed402ea8069a?w=800&q=80',
          ],
        },
        {
          title: 'सिटी पैलेस, जंतर मंतर एवं हवा महल भ्रमण',
          description: 'पूरा दिन जयपुर की शाही विरासत की खोज। भव्य सिटी पैलेस संग्रहालय, खगोलीय वेधशाला जंतर मंतर का दौरा करें और हवा महल की प्रसिद्ध वास्तुकला को निहारें। शाम को जौहरी बाजार में खरीदारी।',
          images: [
            'https://images.unsplash.com/photo-1599661046289-e31897846e41?w=800&q=80',
            'https://images.unsplash.com/photo-1623492701902-47dc207df5dc?w=800&q=80',
          ],
        },
        {
          title: 'झीलों की नगरी उदयपुर की सुंदर यात्रा',
          description: 'अरावली पहाड़ियों से होते हुए उदयपुर के लिए निजी कार द्वारा यात्रा। पिछोला झील पर स्थित अपने लेक पैलेस होटल में चेक-इन करें। शाम को जग मंदिर और सिटी पैलेस की रोशनी देखते हुए नाव की सवारी का आनंद लें।',
          images: [
            'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=800&q=80',
            'https://images.unsplash.com/photo-1615880484746-a134be9a6ecf?w=800&q=80',
          ],
        },
        {
          title: 'उदयपुर सिटी पैलेस एवं सहेलियों की बाड़ी',
          description: 'भव्य उदयपुर सिटी पैलेस परिसर और क्रिस्टल गैलरी का निर्देशित दौरा। अपनी वापसी उड़ान से पहले सहेलियों की बाड़ी के शाही फव्वारों और बगीचों की सैर करें।',
          images: [
            'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=800&q=80',
            'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?w=800&q=80',
          ],
        },
      ],
    },
    items: [
      {
        id: 'hotel-jaipur',
        name: 'रामबाग पैलेस हेरिटेज सुइट, जयपुर',
        kind: 'hotel',
        qty: 2,
        unit_price: 38000,
        images: [
          'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80',
          'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&q=80',
        ],
      },
      {
        id: 'hotel-udaipur',
        name: 'ताज लेक पैलेस लग्ज़री सुइट, उदयपुर',
        kind: 'hotel',
        qty: 2,
        unit_price: 45000,
        images: [
          'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=800&q=80',
        ],
      },
      {
        id: 'flight-return',
        name: 'विस्तारा एक्ज़ीक्यूटिव फ्लाइट एवं निजी कार सेवा',
        kind: 'flight',
        qty: 2,
        unit_price: 12500,
        images: [
          'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=800&q=80',
        ],
      },
      {
        id: 'activity-boat',
        name: 'निजी पिछोला झील सूर्यास्त क्रूज़ एवं गाइड',
        kind: 'activity',
        qty: 1,
        unit_price: 8500,
        images: [
          'https://images.unsplash.com/photo-1615880484746-a134be9a6ecf?w=800&q=80',
        ],
      },
    ],
  },
  bn: {
    id: 'demo-royal-rajasthan',
    name: 'রয়্যাল রাজস্থান ঐতিহ্য ও প্যালেস ভ্রমণ',
    destination: 'জয়পুর ও উদয়পুর, ভারত',
    client_name: 'আদিত্য ও অনন্যা শর্মা',
    travelers: 2,
    currency: 'INR',
    heroImages: [
      'https://images.unsplash.com/photo-1599661046289-e31897846e41?w=1200&q=80',
      'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=1200&q=80',
      'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=1200&q=80',
    ],
    trip_details: {
      days: [
        {
          title: 'গোলাপী শহর জয়পুরে আগমন ও অম্বর দুর্গে সূর্যাস্ত',
          description: 'জয়পুরে আপনাকে স্বাগতম! আপনার ঐতিহ্যবাহী রাজকীয় হোটেলে চেক-ইন করুন। বিকালে মাওটা হ্রদের তীরে অবস্থিত ঐতিহাসিক অম্বর দুর্গ দর্শন এবং সন্ধ্যায় চোখি ধানিতে রাজস্থানি ঐতিহ্যবাহী নৈশভোজ।',
          images: [
            'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=800&q=80',
            'https://images.unsplash.com/photo-1599661046289-e31897846e41?w=800&q=80',
          ],
        },
        {
          title: 'সিটি প্যালেস, যন্তর মন্তর ও হাওয়া মহল ভ্রমণ',
          description: 'সারাদিন জয়পুরের রাজকীয় ঐতিহ্য অন্বেষণ। রাজকীয় সিটি প্যালেস মিউজিয়াম, জ্যোতির্বিজ্ঞান মানমন্দির যন্তর মন্তর দর্শন এবং হাওয়া মহলের স্থাপত্য উপভোগ। সন্ধ্যায় জহরি বাজারে কেনাকাটা।',
          images: [
            'https://images.unsplash.com/photo-1599661046289-e31897846e41?w=800&q=80',
            'https://images.unsplash.com/photo-1623492701902-47dc207df5dc?w=800&q=80',
          ],
        },
        {
          title: 'হ্রদের শহর উদয়পুরের মনোরম যাত্রা',
          description: 'আরাবল্লী পর্বতের মনোরম দৃশ্য উপভোগ করতে করতে ব্যক্তিগত গাড়িতে উদয়পুর যাত্রা। পিছোলা হ্রদের লেক প্যালেস হোটেলে চেক-ইন। সন্ধ্যায় সূর্যাস্তের সময় রোমান্টিক বোট ক্রুজ।',
          images: [
            'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=800&q=80',
            'https://images.unsplash.com/photo-1615880484746-a134be9a6ecf?w=800&q=80',
          ],
        },
        {
          title: 'উদয়পুর সিটি প্যালেস ও সহেলিওঁ কি বাড়ি',
          description: 'উদয়পুর সিটি প্যালেস ও ক্রিস্টাল গ্যালারি দর্শন। বাড়ি ফেরার ফ্লাইটের আগে সহেলিওঁ কি বাড়ির রাজকীয় বাগান ও ফোয়ারা উপভোগ করুন।',
          images: [
            'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=800&q=80',
            'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?w=800&q=80',
          ],
        },
      ],
    },
    items: [
      {
        id: 'hotel-jaipur',
        name: 'রামবাগ প্যালেস হেরিটেজ স্যুইট, জয়পুর',
        kind: 'hotel',
        qty: 2,
        unit_price: 38000,
        images: [
          'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80',
          'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&q=80',
        ],
      },
      {
        id: 'hotel-udaipur',
        name: 'তাজ লেক প্যালেস লাক্সারি স্যুইট, উদয়পুর',
        kind: 'hotel',
        qty: 2,
        unit_price: 45000,
        images: [
          'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=800&q=80',
        ],
      },
      {
        id: 'flight-return',
        name: 'ভিস্তারা এক্সিকিউটিভ ফ্লাইট ও ব্যক্তিগত পরিবহন',
        kind: 'flight',
        qty: 2,
        unit_price: 12500,
        images: [
          'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=800&q=80',
        ],
      },
      {
        id: 'activity-boat',
        name: 'ব্যক্তিগত পিছোলা হ্রদ সূর্যাস্ত ক্রুজ ও গাইড',
        kind: 'activity',
        qty: 1,
        unit_price: 8500,
        images: [
          'https://images.unsplash.com/photo-1615880484746-a134be9a6ecf?w=800&q=80',
        ],
      },
    ],
  },
  mr: {
    id: 'demo-royal-rajasthan',
    name: 'रॉयल राजस्थान हेरिटेज आणि पॅलेस सफर',
    destination: 'जयपूर आणि उदयपूर, भारत',
    client_name: 'आदित्य आणि अनन्य शर्मा',
    travelers: 2,
    currency: 'INR',
    heroImages: [
      'https://images.unsplash.com/photo-1599661046289-e31897846e41?w=1200&q=80',
      'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=1200&q=80',
      'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=1200&q=80',
    ],
    trip_details: {
      days: [
        {
          title: 'गुलाबी शहर जयपूर आगमन आणि आमेर किल्ला सूर्यास्त',
          description: 'जयपूरमध्ये आपले स्वागत आहे! तुमच्या शाही राजवाडा हॉटेलमध्ये चेक-इन करा. दुपारी माओटा तलावाजवळील भव्य आमेर किल्ल्याला भेट द्या, आणि संध्याकाळी चोखी धाणी येथे पारंपारिक राजस्थानी जेवणाचा आस्वाद घ्या.',
          images: [
            'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=800&q=80',
            'https://images.unsplash.com/photo-1599661046289-e31897846e41?w=800&q=80',
          ],
        },
        {
          title: 'सिटी पॅलेस, जंतर मंतर आणि हवा महल दर्शन',
          description: 'जयपूरच्या शाही वारशाची दिवसभर सफर. भव्य सिटी पॅलेस संग्रहालय, जंतर मंतर वेधशाळा आणि प्रसिद्ध हवा महलची वास्तुकला पहा. संध्याकाळी जोहरी बाजारात खरेदीचा आनंद.',
          images: [
            'https://images.unsplash.com/photo-1599661046289-e31897846e41?w=800&q=80',
            'https://images.unsplash.com/photo-1623492701902-47dc207df5dc?w=800&q=80',
          ],
        },
        {
          title: 'तलावांचे शहर उदयपूरकडे निसर्गरम्य प्रवास',
          description: 'अरवली पर्वतरांगांमधून उदयपूरकडे खाजगी कारने प्रवास. पिछोला तलावावरील लेक पॅलेस हॉटेलमध्ये चेक-इन. संध्याकाळी रोमँटिक बोट सफारी आणि सूर्यास्ताचा आनंद.',
          images: [
            'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=800&q=80',
            'https://images.unsplash.com/photo-1615880484746-a134be9a6ecf?w=800&q=80',
          ],
        },
        {
          title: 'उदयपूर सिटी पॅलेस आणि सहेलियो की बाडी',
          description: 'भव्य उदयपूर सिटी पॅलेस आणि क्रिस्टल गॅलरीचा मार्गदर्शित दौरा. परतीच्या प्रवासापूर्वी सहेलियो की बाडीच्या शाही बागा आणि कारंजे पहा.',
          images: [
            'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=800&q=80',
            'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?w=800&q=80',
          ],
        },
      ],
    },
    items: [
      {
        id: 'hotel-jaipur',
        name: 'रामबाग पॅलेस हेरिटेज सुईट, जयपूर',
        kind: 'hotel',
        qty: 2,
        unit_price: 38000,
        images: [
          'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80',
          'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&q=80',
        ],
      },
      {
        id: 'hotel-udaipur',
        name: 'ताज लेक पॅलेस लक्झरी सुईट, उदयपूर',
        kind: 'hotel',
        qty: 2,
        unit_price: 45000,
        images: [
          'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=800&q=80',
        ],
      },
      {
        id: 'flight-return',
        name: 'विस्तारा एक्झिक्युटिव्ह फ्लाईट आणि खाजगी वाहन सेवा',
        kind: 'flight',
        qty: 2,
        unit_price: 12500,
        images: [
          'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=800&q=80',
        ],
      },
      {
        id: 'activity-boat',
        name: 'खाजगी पिछोला तलाव सूर्यास्त क्रूझ आणि मार्गदर्शक',
        kind: 'activity',
        qty: 1,
        unit_price: 8500,
        images: [
          'https://images.unsplash.com/photo-1615880484746-a134be9a6ecf?w=800&q=80',
        ],
      },
    ],
  },
  gu: {
    id: 'demo-royal-rajasthan',
    name: 'રોયલ રાજસ્થાન હેરિટેજ અને પેલેસ પ્રવાસ',
    destination: 'જયપુર અને ઉદયપુર, ભારત',
    client_name: 'આદિત્ય અને અનન્ય શર્મા',
    travelers: 2,
    currency: 'INR',
    heroImages: [
      'https://images.unsplash.com/photo-1599661046289-e31897846e41?w=1200&q=80',
      'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=1200&q=80',
      'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=1200&q=80',
    ],
    trip_details: {
      days: [
        {
          title: 'ગુલાબી નગરી જયપુર આગમન અને આમેર કિલ્લાનો સૂર્યાસ્ત',
          description: 'જયપુરમાં આપનું સ્વાગત છે! તમારી શાહી હેરિટેજ પેલેસ હોટલમાં ચેક-ઇન કરો. બપોરે માઓટા તળાવ નજીક આમેર કિલ્લાની મુલાકાત અને સાંજે ચોખી ધાણીમાં પરંપરાગત રાજસ્થાની ભોજનનો આનંદ માણો.',
          images: [
            'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=800&q=80',
            'https://images.unsplash.com/photo-1599661046289-e31897846e41?w=800&q=80',
          ],
        },
        {
          title: 'સિટી પેલેસ, જંતર મંતર અને હવા મહેલ દર્શન',
          description: 'જયપુરના ભવ્ય વારસાની આખા દિવસની સફર. સિટી પેલેસ મ્યુઝિયમ, ખગોળશાસ્ત્રીય જંતર મંતરની મુલાકાત લો અને હવા મહેલની સ્થાપત્ય કલા નિહાળો. સાંજે ઝવેરી બજારમાં શોપિંગ.',
          images: [
            'https://images.unsplash.com/photo-1599661046289-e31897846e41?w=800&q=80',
            'https://images.unsplash.com/photo-1623492701902-47dc207df5dc?w=800&q=80',
          ],
        },
        {
          title: 'સરોવરોની નગરી ઉદયપુર તરફ મનોરમ સફર',
          description: 'અરવલ્લીની ટેકરીઓમાંથી ઉદયપુર સુધી ખાનગી કાર દ્વારા પ્રવાસ. પિછોલા તળાવ પર આવેલી લેક પેલેસ હોટલમાં ચેક-ઇન. સાંજે રોમેન્ટિક બોટ સવારી અને સૂર્યાસ્તનો આનંદ.',
          images: [
            'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=800&q=80',
            'https://images.unsplash.com/photo-1615880484746-a134be9a6ecf?w=800&q=80',
          ],
        },
        {
          title: 'ઉદયપુર સિટી પેલેસ અને સહેલિયોં કી બાડી',
          description: 'ભવ્ય ઉદયપુર સિટી પેલેસ અને ક્રિસ્ટલ ગેલેરીની ગાઇડેડ મુલાકાત. પરત ફરતા પહેલા સહેલિયોં કી બાડીના શાહી બગીચા અને ફુવારાની મુલાકાત લો.',
          images: [
            'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=800&q=80',
            'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?w=800&q=80',
          ],
        },
      ],
    },
    items: [
      {
        id: 'hotel-jaipur',
        name: 'રામબાગ પેલેસ હેરિટેજ સુઇટ, જયપુર',
        kind: 'hotel',
        qty: 2,
        unit_price: 38000,
        images: [
          'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80',
          'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&q=80',
        ],
      },
      {
        id: 'hotel-udaipur',
        name: 'તાજ લેક પેલેસ લક્ઝરી સુઇટ, ઉદયપુર',
        kind: 'hotel',
        qty: 2,
        unit_price: 45000,
        images: [
          'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=800&q=80',
        ],
      },
      {
        id: 'flight-return',
        name: 'વિસ્તારા એક્ઝિક્યુટિવ ફ્લાઇટ અને ખાનગી વાહન સેવા',
        kind: 'flight',
        qty: 2,
        unit_price: 12500,
        images: [
          'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=800&q=80',
        ],
      },
      {
        id: 'activity-boat',
        name: 'ખાનગી પિછોલા સરોવર સૂર્યાસ્ત ક્રૂઝ અને ગાઇડ',
        kind: 'activity',
        qty: 1,
        unit_price: 8500,
        images: [
          'https://images.unsplash.com/photo-1615880484746-a134be9a6ecf?w=800&q=80',
        ],
      },
    ],
  },
};

/**
 * Helper vocabulary map for fallback dynamic translation of custom proposals
 */
const VOCAB_MAP = {
  hi: {
    'Hotel': 'होटल',
    'Flight': 'उड़ान',
    'Activity': 'गतिविधि',
    'Transfer': 'परिवहन',
    'Day': 'दिन',
    'Welcome': 'स्वागत है',
    'Arrival': 'आगमन',
    'Departure': 'प्रस्थान',
    'Tour': 'भ्रमण',
    'Palace': 'महल',
    'Lake': 'झील',
  },
  bn: {
    'Hotel': 'হোটেল',
    'Flight': 'ফ্লাইট',
    'Activity': 'কার্যক্রম',
    'Transfer': 'পরিবহন',
    'Day': 'দিন',
    'Welcome': 'স্বাগতম',
    'Arrival': 'আগমন',
    'Departure': 'প্রস্থান',
    'Tour': 'ভ্রমণ',
    'Palace': 'প্রাসাদ',
    'Lake': 'হ্রদ',
  },
  mr: {
    'Hotel': 'हॉटेल',
    'Flight': 'विमान',
    'Activity': 'उपक्रम',
    'Transfer': 'वाहतूक',
    'Day': 'दिवस',
    'Welcome': 'स्वागत',
    'Arrival': 'आगमन',
    'Departure': 'प्रस्थान',
    'Tour': 'सफर',
    'Palace': 'राजवाडा',
    'Lake': 'तलाव',
  },
  gu: {
    'Hotel': 'હોટલ',
    'Flight': 'ફ્લાઇટ',
    'Activity': 'પ્રવૃત્તિ',
    'Transfer': 'ટ્રાન્સપોર્ટ',
    'Day': 'દિવસ',
    'Welcome': 'સ્વાગત',
    'Arrival': 'આગમન',
    'Departure': 'પ્રસ્થાન',
    'Tour': 'પ્રવાસ',
    'Palace': 'મહેલ',
    'Lake': 'તળાવ',
  },
};

/**
 * Get UI text for a key in given language code
 */
export function getUIText(lang, key) {
  const dict = UI_TRANSLATIONS[lang] || UI_TRANSLATIONS.en;
  return dict[key] || UI_TRANSLATIONS.en[key] || key;
}

/**
 * Translates arbitrary text or falls back to source text
 */
export function translateText(text, langCode) {
  if (!text || typeof text !== 'string' || langCode === 'en') return text;
  const vocab = VOCAB_MAP[langCode] || {};
  let out = text;
  Object.entries(vocab).forEach(([enWord, localWord]) => {
    const reg = new RegExp(`\\b${enWord}\\b`, 'gi');
    out = out.replace(reg, localWord);
  });
  return out;
}
