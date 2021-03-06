const botBuilder = require('claudia-bot-builder');
const fbTemplate = botBuilder.fbTemplate;
const utils = require('./utils.js')
const sugarUtils = require('../modules/sugarUtils.js')
const nutrition = require ('../modules/nutritionix.js')
const constants = require('./constants.js')

const firebase = require('firebase')
if (firebase.apps.length === 0) {
  firebase.initializeApp(constants.fbConfig)
}

exports.trackSugar = function() {
  // let cheatDay = new Date(Date.now()).getDay()
  // if (cheatDay == 0) {
  //   return 'Today is your cheat day! Enjoy responsibly 😇'
  // }
  return new fbTemplate.Button('Would you like to add it to your journal?')
  .addButton('Yes  ✅', 'add sugar')
  .addButton('No  ❌', 'remove temp food data')
  .addButton('Custom 🛠', 'custom sugar for food')
  .get()
}

exports.findMyFavorites = function(favoriteMeal, userId, date, fulldate) {
  let objRef = firebase.database().ref('/global/sugarinfoai/' + userId + '/myfoods/' + favoriteMeal + '/')
  return objRef.once("value")
  .then(function(snapshot) {
    if (snapshot.exists()) {
      let sugarPerServing = snapshot.child('sugar').val()
      let sugarPerServingStr = snapshot.child('sugarPerServingStr').val()
      let ingredientsSugarsCaps = snapshot.child('ingredientsSugarsCaps').val()
      console.log('results', sugarPerServing, sugarPerServingStr, ingredientsSugarsCaps)
      return firebase.database().ref('/global/sugarinfoai/' + userId + '/temp/data/favorites').remove()
      .then(() => {
        var tempRef = firebase.database().ref("/global/sugarinfoai/" + userId + "/temp/data/")
        let sugar = parseInt(sugarPerServing)
        if (!ingredientsSugarsCaps)
          ingredientsSugarsCaps = ''
        return tempRef.child('food').set({
          sugar: sugarPerServing,
          foodName: favoriteMeal,
          sugarPerServingStr,
          cleanText: favoriteMeal,
          ingredientsSugarsCaps
        })
        .then(() => {
          return exports.addSugarToFirebase(userId, date, fulldate)
        })
      })
    }
    else {
      return nutrition.getNutritionix(favoriteMeal, userId, '', false)
    }
  })
  .catch(error => {
    console.log('Errors', error)
  })
}

exports.trackUserProfile = function(userId) {
  var fbOptions = {
    uri: 'https://graph.facebook.com/v2.6/' + userId,
    method: 'GET',
    json: true,
    qs: {
      fields: 'first_name,last_name,profile_pic,locale,timezone,gender',
      access_token: 'EAAJhTtF5K30BAObDIIHWxtZA0EtwbVX6wEciIZAHwrwBJrXVXFZCy69Pn07SoyzZAeZCEmswE0jUzamY7Nfy71cZB8O7BSZBpTZAgbDxoYEE5Og7nbkoQvMaCafrBkH151s4wl91zOCLbafkdJiWLIc6deW9jSZBYdjh2NE4JbDSZBAwZDZD'
    },
    resolveWithFullResponse: true
  }
  const request = require('request-promise')
  return request(fbOptions)
  .then(result => {
    console.log('User Data Fetched', result)
    const data = result.body
    // console.log('Data', data)
    const {first_name, last_name, profile_pic, locale, timezone, gender} = data
    var userRef = firebase.database().ref("/global/sugarinfoai/" + userId + "/profile")
    return userRef.update({
      first_name,
      last_name,
      profile_pic,
      locale,
      timezone,
      gender,
      userId,
      // is_payment_enabled
    })
  })
  .catch(error => {
    console.log('Something went wrong', error)
  })
}

exports.calculateDailyTracking = function(weight, sugar, userId, goalSugar) {
  //default to 60 g of sugar, 15 cubes of sugar
  // ⬜️  - unused
  // ☑️  - used
  // 🅾️  - over
  let quota = Math.round(goalSugar/4)
  let used = Math.round(sugar/4)
  let over = 0
  let unused = 0
  let retLine = ''
  if (used > quota) {
    over = used - quota
    used = quota
    unused = 0
  }
  else {
    unused = quota - used
  }
  for (let i = 0; i < over; i++) {
    retLine += '🅾️'
  }
  for (let i = 0; i < used; i++) {
    retLine += '✅ '
  }
  for (let i = 0; i < unused; i++) {
    retLine += '⬜️ '
  }
  console.log(retLine)
  return retLine
}

function subSlashes( str ) {
  if (str) {
    return str.replace(/[\/\.$#\[\]]/g, '_');
  }
  return ''
}

exports.addSugarToFirebase = function(userId, date, fulldate) {
  // console.log('in add sugar to firebase')
  // var date = new Date(Date.UTC(dateValue.getFullYear(), dateValue.getMonth(), dateValue.getDate(), dateValue.getHours(), dateValue.getMinutes(), dateValue.getSeconds()))
  console.log('######################## DATE', date)
  // console.log('Unaltered time: ', (new Date(Date.now())).toString())
  // console.log('Altered time: ', dateValue.toString());     // logs Wed Jul 28 1993 14:39:07 GMT-0600 (PDT)
  // console.log(dateValue.toTimeString()); // logs 14:39:07 GMT-0600 (PDT)
  var tempRef = firebase.database().ref("/global/sugarinfoai/" + userId)
  return tempRef.once("value")
  .then(function(snapshot) {
    var sugar = snapshot.child('/temp/data/food/sugar').val()
    var foodName = snapshot.child('/temp/data/food/foodName').val()
    var cleanText = snapshot.child('/temp/data/food/cleanText').val()
    var sugarPerServingStr = snapshot.child('/temp/data/food/sugarPerServingStr').val()
    var ingredientsSugarsCaps = snapshot.child('/temp/data/food/ingredientsSugarsCaps').val()
    var photo = snapshot.child('/temp/data/food/photo').val()
    var sugarArr = snapshot.child('/temp/data/food/sugarArr').val()
    var userRef = firebase.database().ref("/global/sugarinfoai/" + userId + "/sugarIntake/" + date)
    userRef.push({
      foodName,
      userId,
      timestamp: fulldate,
      sugar,
      photo,
      sugarArr
    })
    var weight = snapshot.child('/preferences/currentWeight').val()
    var goalWeight = snapshot.child('/preferences/currentGoalWeight').val()
    var goalSugar = snapshot.child('/preferences/currentGoalSugar').val()
    var val = snapshot.child('/sugarIntake/' + date + '/dailyTotal/sugar').val()
    if (!val)
      val = 0
    if (!goalSugar)
      goalSugar = 36
    var newVal = parseInt(val) + parseInt(sugar)
    console.log('+++++++++++++++++++++', cleanText)
    if (foodName === 'missing upc' || !cleanText) {
      return firebase.database().ref('/global/sugarinfoai/' + userId + '/sugarIntake/' + date + '/dailyTotal/').update({ sugar: newVal })
      .then(() => {
        return firebase.database().ref('/global/sugarinfoai/' + userId +'/temp/data/').remove()
        .then(() => {
          let track = exports.calculateDailyTracking(weight, newVal, userId, goalSugar)
          console.log('  adding report request to firebase')
          const dbReportQueue = firebase.database().ref("/global/sugarinfoai/reportQueue")
          const dbReportQueueRequest = dbReportQueue.push()
          dbReportQueueRequest.set(reportRequest)
          return [
            // 'Added ' + sugar + 'g to your journal',
            // 'Okay, I\'ve updated your journal and see that you\'ve had about ' + Math.ceil(sugar*100/goalSugar) + '% (' + sugar + 'g) of your daily allowance (' + goalSugar + 'g)',
            'Okay—you just ate about ' + Math.ceil(sugar*100/goalSugar) + '% (' + sugar + 'g) of your goal: ' + goalSugar + 'g. I have updated your journal'
            // 'Your current daily sugar intake is ' + newVal + 'g of ' + goalSugar + 'g',
            // "Here's your daily intake",
            // 'With sugar less is more!',
            // 'The green cube(s) below represent how much of your sugar goal (' + goalSugar + ') you\'ve had today.',
            // track,
            // new fbTemplate.Button('You can check your meal report here')
            // .addButton('Report 💻', 'report')
            // .get(),
            // utils.sendReminder()
            // utils.trackAlertness()
            // 'You can check your sugar report below.'
          ]
        })
      })
    }
    let cleanPath = subSlashes(cleanText)
    // const cleanName = foodName.substr(0, foodName.indexOf(' ')).toLowerCase()
    // console.log(cleanName)
    // var sugarRef = firebase.database().ref("/global/sugarinfoai/" + userId + "/sugarIntake/" + date + "/dailyTotal")
    return firebase.database().ref('/global/sugarinfoai/' + userId + '/sugarIntake/' + date + '/dailyTotal/').update({ sugar: newVal })
    .then(() => {
      return firebase.database().ref('/global/sugarinfoai/' + userId + '/myfoods/' + cleanPath).update({ 
        cleanText,
        sugar,
        sugarArr,
        sugarPerServingStr,
        ingredientsSugarsCaps,
        photo
      })
      .then(() => {
        return firebase.database().ref('/global/sugarinfoai/' + userId + '/myfoods/' +  cleanPath + '/date').push({ 
          timestamp: Date.now(),
        })
        .then(() => {
          return firebase.database().ref('/global/sugarinfoai/' + userId +'/temp/data').remove()
          .then(() => {
            const reportRequest = {
              reportType: 'dailySummary',
              userId: userId,
              userTimeStamp: fulldate
            }
            console.log('  adding report request to firebase')
            const dbReportQueue = firebase.database().ref("/global/sugarinfoai/reportQueue")
            const dbReportQueueRequest = dbReportQueue.push()
            dbReportQueueRequest.set(reportRequest)
            let track = exports.calculateDailyTracking(weight, newVal, userId, goalSugar)
            return [
              // 'Added ' + sugar + 'g to your journal',
              // 'Okay, I\'ve updated your journal and see that you\'ve had about ' + Math.ceil(sugar*100/goalSugar) 
               // + '% (' + sugar + 'g) of your daily allowance (' + goalSugar + 'g)',
              'Okay—you just ate about ' + Math.ceil(sugar*100/goalSugar) + '% (' + sugar + 'g) of your goal: ' + goalSugar + 'g. I have updated your journal'
              // 'Your current daily sugar intake is ' + newVal + 'g of ' + goalSugar + 'g',
              // "Here's your daily intake",
              // 'With sugar less is more!',
              // 'The green cube(s) below represent how much of your sugar goal (' + goalSugar + ') you\'ve had today.',
              // track,
              // new fbTemplate.Button('You can check your meal report here')
              // .addButton('Report 💻', 'report')
              // .get(),
              // utils.sendReminder()
              // utils.trackAlertness()
              // 'You can check your sugar report below.'
            ]
          })
        })
      })
    })
    .catch(function(error) {
      console.log('Firebase Error ', error);
    });
  })
  .catch((error) => {
    console.log('Error', error)
  })
}

exports.sugarChecker = function(messageText, userId) {
  console.log('Inside not sugar checker', messageText)
  const result = sugarUtils.getSugarII(messageText)
  if (result &&
      result !== '') {
    console.log('That is a processed sugar')
    var tempRef = firebase.database().ref("/global/sugarinfoai/" + userId + "/temp/data/")
    return tempRef.child('sugar').remove()
    .then(() => {
      return [
        `That's a processed sugar ingredient!`,
        utils.otherOptions(false)
      ]
    })
  }
  else {
    console.log('That is NOT a processed sugar')
    var tempRef = firebase.database().ref("/global/sugarinfoai/" + userId + "/temp/data/")
    return tempRef.child('sugar').remove()
    .then(() => {
      return [
        `That's not a processed sugar ingredient!`,
        utils.otherOptions(false)
      ]
    })
  }
}
