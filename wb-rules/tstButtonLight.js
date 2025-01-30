var button = require('moduleButtonLight');


// Создаем группу, с указанием датчика движения
var but1 = [
    'testButton/Input 1'
];
var light1 = [ 
    'wb-mr6c_1/K3',                     
    'wb-mr6c_1/K4',
    'wb-mr6c_1/K5'  
]; 
var motion1 = [
    'wb-msw-v4_80/Current Motion'
];
button.createLightingGroup ('Тестовая группа света №1' , 'groupLight_1' , but1 , light1 , false , motion1 );

// Создаем обычный выключатель. Одна кнопка одно реле
var but2 = [
    'testButton/Input 2'
];
var light2 = [
    'wb-mr6c_1/K6'
];
button.createLightingGroup ('Тестовая группа света №2' , 'groupLight_2' , but2 , light2 );


//Создаем мастер выключатель
var but = [
    'wb-mcm8_76/Input 7 counter'
];
var light = [
    'wb-mr6c_1/K3',
    'wb-mr6c_1/K4',
    'wb-mr6c_1/K5',
    'wb-mr6c_1/K6'
];                       
button.createLightingGroup ('Мастер выключатель' , 'globalLight' , but , light , true );