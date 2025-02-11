
/**
 * @brief   Данная функция создает виртуальное устройство для управления группой света.
 * @authors SmithLEDs (https://github.com/SmithLEDs/wb-buttonLight)
 * @version v.1.5
 * 
 * @param {String}  title           Описание виртуального устройства (Можно на русском)
 * @param {String}  name            Имя виртуального устройства (Будет отображаться в новом виртуальном кстройстве как name/... )
 * @param {String}  targetButton    Одиночный топик или массив топиков, по изменению которых 
 *                                  будет происходить переключение света (Кнопки)
 * @param {String}  targetLight     Одиночный топик или массив топиков, которыми будет происходить управление (Реле)
 * @param {boolean} master          true - если это мастер выключатель. Перед отключением группы - запомнит 
 *                                  состояние реле и выключит, а при включении включит только те, которые были включены
 * @param {String}  targetMotion    Одиночный топик или массив топиков, по которым будет отслеживаться движение
 *                                  для включения или отключения группы света (Необязательный - если не указать, то 
 *                                  и не создадутся контролы для управления по движению).
 */

// Объект для хранения устройств кнопок или выключателей
var button = {
    target: [],  
    error: [],
    virt: [],
    value: [],
    name: "",
    exist: false
};
// Объект для хранения устройств реле
var light = {
    target: [],  
    error: [],
    virt: [],
    value: [],
    name: "",
    exist: false
};
// Объект для хранения устройств движения
var motion = {
    target: [],  
    error: [],
    virt: [],
    value: [],
    timeout: 10,
    sens: 35,
    name: "",
    exist: false
};

function createLightingGroup ( title , name , master ) {

    var firstStartRule = true;      // Флаг первого запуска модуля или перезагрузки правил

    if ( master ) {
        var ps = new PersistentStorage( name + "_storage", { global: true }); // Постоянное хранилище для запоминания состояний реле
    }

    createVirtualDevice( title , name );

    // Создаем новое правило для отслеживания переключений виртуальных кнопок,
    // что бы управлять физическими реле прямо из виртуального устройства
    defineRule(name + ' ruleLight', {
        whenChanged: light.virt,
        then: function (newValue, devName, cellName) {
            var i = light.virt.indexOf( devName + '/' + cellName );
            if ( i != -1 ) dev[light.target[i]] = newValue;
        }
    });
    
    /**
     * @brief   Правило обработки перезагрузки правил - по идее должно выполниться всего один раз в самом начале.
     *          Тут перебираем массив источников света "targetLight" и добавляем новые контролы этих источников в виртуальное устройство.
     *          Сразу при добавлении считываем текущее состояние реле. forceDefault обязателен.
     *          Так при обновлении правил новые виртуальные контролы перезагружаются с правильными состояния физических реле.
     */
    defineRule(name + '_rebootRule', {
        asSoonAs: function() {
            return firstStartRule;
        },
        then: function () {

            if ( button.exist ) {
                button.target.forEach( function (item, index, arr) {
                    var itemType = "";
                    switch( typeof dev[item] ) {
                        case 'boolean':
                            itemType = "switch";
                        break;
                        case 'number':
                            itemType = "value";
                        break;
                    }

                    button.value[index] = dev[item];
                    getDevice(name).addControl( "button_" + index , { 
                        title: item, 
                        type: itemType, 
                        value: button.value[index], 
                        readonly: true,
                        forceDefault: true
                    });   
                    if ( dev[button.error[index]] !== undefined ) {
                        dev[button.virt[index] + '#error'] = dev[button.error[index]];
                    }             
                });
            } else {
                getDevice(name).addControl( "ButtonAlarm", { 
                    title: "Отсутствует физическое управление", 
                    type: "alarm", 
                    value: true
                });   
            }

            var flagON = false;
            light.target.forEach( function (item, index, arr) {
                light.value[index] = dev[item];
                getDevice(name).addControl( "light_" + index , { 
                    title: item, 
                    type: "switch", 
                    value: light.value[index], 
                    readonly: false,
                    forceDefault: true
                });
                if ( light.value[index] ) flagON = true;
                
                if ( dev[light.error[index]] !== undefined ) {
                    dev[light.virt[index] + '#error'] = dev[light.error[index]];
                }
            });
            dev[name]['qtyLight'] = light.target.length;
            dev[name]['qtyButton'] = button.target.length;
            dev[name]['stateGroup'] = flagON;



            // Если указали датчики движения, то создаем нужные контролы
            if ( motion.exist ) {
                getDevice(name).addControl( "motion" , { 
                    title: "Присутствие в зоне", 
                    type: "switch", 
                    value: false, 
                    readonly: true
                });
                getDevice(name).addControl( "motionLightON" , { 
                    title: "Включать свет при начале движения", 
                    type: "switch", 
                    value: false, 
                    readonly: false
                });
                getDevice(name).addControl( "timeout" , { 
                    title: "Таймаут отключения света, мин.", 
                    type: "range", 
                    value: motion.timeout, 
                    readonly: false,
                    min: 1,
                    max: 30
                });
                getDevice(name).addControl( "sensitivity" , { 
                    title: "Чувствительность датчика", 
                    type: "range",
                    value: motion.sens,
                    readonly: false,
                    min: 1,
                    max: 500
                });

                motion.target.forEach( function(item, index, arr) {
                    motion.value[index] = dev[item];
                    getDevice(name).addControl( "motion_" + index , { 
                        title: item, 
                        type: "value", 
                        value: motion.value[index], 
                        readonly: true,
                        forceDefault: true
                    });
                    if ( dev[motion.error[index]] !== undefined ) {
                        dev[motion.virt[index] + '#error'] = dev[motion.error[index]];
                    }
                });
            }
        }
    });


    /**
     * @brief   Правило отслеживает нажатие виртуальной кнопки "button".
     *          -   Включение или отключение основывается на виртуальном контроле
     *              "stateGroup". Если группа включена, то все отключаем и наоборот.
     *          -   Если это мастер-выключатель, то перед отключением запоминает 
     *              состояние реле в энергонезависимую память.
     */
    defineRule(name + '_clickButtonVirtual', {
        whenChanged: name + '/button',
        then: function () {   
            light.target.forEach( function (item) {
                if ( master ) {
                    // Если это мастер-выключатель, то перед отключением запоминаем состояние
                    if ( dev[name]['stateGroup'] ) {
                        ps[item] = dev[item];
                        dev[item] = false;
                    } else {
                        dev[item] = ps[item];
                    }

                } else {
                    // Если просто выключатель, то инверируем реле согласно состоянию группы
                    dev[item] = !dev[name]['stateGroup'];
                }
            });         
        }
    });

    // Отслеживаем нажатие физической кнопки
    defineRule(name + '_clickButtonPhysical', {
        whenChanged: button.target,
        then: function (newValue, devName, cellName) {
            dev[name]['button'] = true;

            // Изменяем наш виртуальный контрол для наглядности
            var i = button.target.indexOf( devName + '/' + cellName );
            if ( i != -1 ) {
                button.value[i] = newValue;
                dev[button.virt[i]] = newValue;
            }
        }
    });


    // Отслеживаем изменение переключений физических реле и записываем в контролы для визуализации
    defineRule(name + '_releChange', {
        whenChanged:  light.target,
        then: function (newValue, devName, cellName) {
            var flagON = false;

            // Изменяем наш виртуальный контрол для наглядности и записываем новое значение
            var i = light.target.indexOf( devName + '/' + cellName );
            if ( i != -1 ) {
                light.value[i] = newValue;
                dev[light.virt[i]] = newValue;
            }

            // Тут проверяем состояние всех реле
            for (var k = 0, l = light.value.length; k<l; ++k) {
                if ( light.value[k] ) {
                    flagON = true;
                    break;
                }
            }

            if ( motion.exist ) {
                // Если предедущее значение было отключено и включилась группа
                // и нет движения
                if ( flagON && !dev[name]['stateGroup'] && !dev[name]['motion']) {
                    if (idTimer) clearTimeout(idTimer);
                    idTimer = startTimer();
                }
            }

            dev[name]['stateGroup'] = flagON;
        }
    });


    // Отслеживаем изменение датчиков движения, если они есть
    if ( motion.exist ) {

        var idTimer = null;            // Индификатор таймера для отключения света

        // Создаем функцию, которая создает таймер для отключения света по таймауту "timeout"
        function startTimer() {
            return setTimeout(function () {
                if ( dev[name]['stateGroup'] ) {
                    dev[name]['button'] = true;
                    log.debug('[' + title + ']: Выключение по таймауту ' + dev[name]['timeout'] + ' мин. ');
                }
                idTimer = null;
                
            }, motion.timeout * 1000 * 60 ); //
        }

        // Правило отслеживает изменение чувствительности датчиков
        defineRule(name + '_sensitivityChange', {
            when: function () {
                return dev[name]['sensitivity'];
            },
            then: function () {
                motion.sens = dev[name]['sensitivity'];
            }
        });

        // Правило отслеживает изменение таймаута отключения света
        defineRule(name + '_timeoutChange', {
            when: function () {
                return dev[name]['timeout'];
            },
            then: function () {
                motion.timeout = dev[name]['timeout'];
            }
        });

        // Правило отслеживает изменение датчиков движения
        defineRule(name + '_motionChange', {
            whenChanged: motion.target,
            then: function (newValue, devName, cellName) {

                // Изменяем наш виртуальный контрол для наглядности
                var i = motion.target.indexOf( devName + '/' + cellName );
                if ( i != -1 ) {
                    motion.value[i] = newValue;
                    dev[motion.virt[i]] = newValue;
                }

                var move = false;
                // Перебираем массив значений, и если хоть одно значение больше чувствительности взводим флаг
                for (var i = 0, l = motion.value.length; i < l; ++i) {
                    if (motion.value[i] > motion.sens) {
                        move = true;
                        break;
                    }
                }

                dev[name]['motion'] = move;
            }
        });

        // Правило для отслеживания начала движения
        defineRule(name + '_motionON', {
            asSoonAs: function() {
                return dev[name]['motion'];
            },
            then: function () {
                // Очищаем таймер при появлении движения
                if ( idTimer ) {
                    clearTimeout( idTimer );
                    idTimer = null;
                }
                // Если активно включение света при начале движения
                if ( dev[name]['motionLightON'] ) {
                    if ( !dev[name]['stateGroup'] ) {
                        dev[name]['button'] = true;
                    }
                }
            }
        });

        // Правило для отслеживания прекращения движения
        defineRule(name + '_motionOFF', {
            asSoonAs: function() {
                return !dev[name]['motion'];
            },
            then: function () {
                if (idTimer) clearTimeout(idTimer);
                idTimer = startTimer();
            }
        });
    }


}



/**
 * @brief   Функция создания виртуального устройства.
 *          В дальнейшем к этому устройству добавляются дополнительные контролы
 * @param {String}  title   Описание виртуального устройства (Можно на русском)
 * @param {String}  name    Имя виртуального устройства (Будет отображаться в новом виртуальном кстройстве как name/... )
 */
function createVirtualDevice( title , name ) {
    defineVirtualDevice( name, {
        title: title,
        cells: {
            // Здесь только отображаем общее состояние группы.
            // Если хоть одно реле включено, то true ( смотри правило "_releChange" )
            stateGroup: {
                title: 'Состояние группы',
                type: "switch",
                value: false,
                readonly: true,
                forceDefault: true
            },
            // Виртуальная кнопка для управления группой реле
            button: {
                title: 'Вкл/Выкл группу',
                type: "pushbutton",
            },
            // Тут просто выводим общее кол-во реле в группе
            qtyLight: {
                title: 'Кол-во групп света',
                type: "value",
                value: 0,
                readonly: true
            },
            // Тут просто выводим общее кол-во физических кнопок
            qtyButton: {
                title: 'Кол-во выключателей',
                type: "value",
                value: 0,
                readonly: true
            }
        }
    });
}
/**
 * @brief   Функция создает правило для слежения за meta #error
 * 
 * @param {*} target Структура на список устройств
 */
function createErrorRule( target ) {
    if ( !target.exist ) return;
    defineRule(target.name + ' ruleError', {
        whenChanged:  target.error,
        then: function (newValue, devName, cellName) {
            var i = target.error.indexOf( devName + '/' + cellName );
            if ( i != -1 ) dev[target.virt[i] + '#error'] = newValue;
        }
    });
}


/**
 * @brief   Функция перебирает массив устройств и добавляет существующие
 *          устройства к объекту с массивами, с которым в дальнейшем работает главная 
 *          функция
 * @param {*} source        Массив или переменная - источник физических устройств
 * @param {*} target        Объект, в которую добавятся только существующие устройства
 * @param {*} name          Имя для добавления нового виртуального устройства
 */
function reloadDeviceArray( source , target , name ) {
    if ( source.constructor === Array ) {
        var i = 0;
        source.forEach( function (item, index, arr) {
            if ( deviceExists(item) ) {
                target.target.push( item );
                target.error.push( item + "#error" );
                target.virt.push( name + i );
                i++;
                target.exist = true;
            }
        });
    } else {
        if ( deviceExists(source) ) {
            target.target.push( source );
            target.error.push( source + "#error" );
            target.virt.push( name + 0 );
            target.exist = true;
        }
    }


}


/**
 * @brief   Функция проверяет на существование одного устройства и его контрола.
 * 
 * @param {String} topic Топик для проверки типа "device/control"
 */
function deviceExists( topic ) {
    var device  = topic.split('/')[0];
    var control = topic.split('/')[1];
    var exists = false;

    if ( getDevice(device) !== undefined ) {
        if ( getDevice(device).isControlExists(control) ) {
            exists = true;
        }
    }

    return exists;
}


/**
 * @brief   Функция проверяет на существование устройств.
 * 
 * @param {String} topic Топик или массив топиков для проверки типа "device/control"
 * @return Если хоть одно устройство не доступно, то сразу же возвращаем false
 */
function devicesExists( topic ) {
    var exists = true;
    if (topic == undefined) return false;
    if ( topic.constructor === Array ) {
        topic.forEach( function (item, index, arr) {
            if ( !deviceExists(item) ) exists = false;
        });
    } else {
        if ( !deviceExists(topic) ) exists = false;
    }
    
    return exists;
}



exports.createLightingGroup  = function( title , name , targetButton , targetLight , master , targetMotion ) {
    log.warning('[' + title + ']: Перезагрузка модуля, ожидание устройств...');
    var test_interval = null;
    var i = 0;
    var qty = 60;
    
    test_interval = setInterval(function () {
        var loadDivicesOK = true;
        ++i;
        if ( !devicesExists(targetButton) ) loadDivicesOK = false;
        if ( !devicesExists(targetLight) )  loadDivicesOK = false;
        if ( !devicesExists(targetMotion) ) loadDivicesOK = false;
        
        // Если все устройства существуют или закончилось кол-во попыток проверок
        if ( loadDivicesOK || (i > qty) ) {
            clearInterval(test_interval);

            reloadDeviceArray( targetButton , button , name + '/button_' );
            button.name = name + ' (buttonDevices)';

            reloadDeviceArray( targetMotion , motion , name + '/motion_' );
            motion.name = name + ' (motionDevices)';
            
            reloadDeviceArray( targetLight , light , name + '/light_' );
            light.name = name + ' (lightDevices)';
            
            createErrorRule( motion );
            createErrorRule( button );
            createErrorRule( light );

            if ( !light.exist ) {
                log.error("Нет ни одного устройства для управления светом! Выходим");
            } else { 
                createLightingGroup ( title , name , master );
            }

        }

      }, 5000);  
} 